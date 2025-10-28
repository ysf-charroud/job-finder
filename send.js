import createTransporter from "./nodemailer.js";
import dotenv from "dotenv";
import fs from "fs/promises";
import path, { format } from "path";
import handlebars from "handlebars";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// load environment variables
const {
  SERVICE = "gmail",
  FROM_EMAIL,
  YOUR_NAME = "Your Name",
  APP_PASSWORD,
  TEMPLATE_NAME = "template.hbs",
  FILTER_FIELD = "Informatique",
  DEFAULT_SUBJECT = "Hello",
} = process.env;

if (!FROM_EMAIL || !APP_PASSWORD) {
  console.error("❌ Missing FROM_EMAIL or APP_PASSWORD in .env file.");
  process.exit(1);
}
// create nodemailer transporter
const transporter = createTransporter(SERVICE, FROM_EMAIL, APP_PASSWORD);

async function loadTemplate(filePath) {
  const templateStr = await fs.readFile(filePath, "utf8");
  return handlebars.compile(templateStr);
}

function formatSubject(template, company) {
  const placeholders = {
    "<company_name>": company.EntrepriseName || "",
    "<contact_person>": company.EntrepriseContactName || "",
    "<city>": company.EntrepriseVille || "",
    "<custom_field>": company.EntrepriseSecteurActivite || "",
  };

  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(key, "gi"), value);
  }
  return result.trim();
}

async function main() {
  try {
    // load company data
    const dataPath = path.join(__dirname, "companies.json");
    const rawData = await fs.readFile(dataPath, "utf8");
    const companies = JSON.parse(rawData);

    if (!Array.isArray(companies) || companies.length === 0) {
      console.error("❌ No company data found in companies.json.");
      process.exit(1);
    }
    const filteredCompanies = companies.filter((c) =>
      c?.EntrepriseSecteurActivite?.toLowerCase().includes(
        FILTER_FIELD.toLowerCase()
      )
    );
    if (filteredCompanies.length === 0) {
      console.error("❌ No valid company found after filter.");
      process.exit(1);
    }

    // compile template
    const templatePath = path.join(__dirname, "templates", TEMPLATE_NAME);
    const compileTemplate = await loadTemplate(templatePath);

    if (!compileTemplate) {
      console.error("❌ Failed to load email template.");
      process.exit(1);
    }

    const results = [];

    for (const company of filteredCompanies) {
      if (!company.EntrepriseContactEmail) {
        console.warn(`⚠️ Skipping ${company.EntrepriseName} (no email)`);
        continue;
      }

      const html = compileTemplate({
        ...company,
        your_name: YOUR_NAME,
      });

      // Subject line can use company name
      const subject = formatSubject(DEFAULT_SUBJECT, company);

      const mailOptions = {
        from: FROM_EMAIL,
        to: company.EntrepriseContactEmail,
        subject,
        html,
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(
          `✅ Sent to ${company.EntrepriseContactEmail} (${info.messageId})`
        );
        results.push({ email: company.EntrepriseContactEmail, status: "sent" });
      } catch (err) {
        console.error(
          `❌ Failed to send to ${company.EntrepriseContactEmail}: ${err.message}`
        );
        results.push({
          email: company.EntrepriseContactEmail,
          status: "error",
          error: err.message,
        });
      }
    }

    console.log("\n📬 All done.");
    console.table(results);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main();
