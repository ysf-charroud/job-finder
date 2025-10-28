import nodemailer from "nodemailer";

const createTransporter = (service, user, pass) => {
  const transporter = nodemailer.createTransport({
    service,
    auth: { user, pass },
  });
  return transporter;
};

export default createTransporter;
