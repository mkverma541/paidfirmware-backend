require("dotenv").config();
const nodemailer = require("nodemailer");
const fs = require("fs");
const handlebars = require("handlebars");
const path = require("path");

async function sendEmail(email, subject, templateName, data) {
  // Create a transport object using Mailgun SMTP
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // Use `true` for port 465, `false` for other ports
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const templatePath = path.join(
    __dirname,
    "../../email-templates", // Path to email templates
    `${templateName}.hbs`
  );
  const source = fs.readFileSync(templatePath, "utf8");
  const compiledTemplate = handlebars.compile(source);
  const htmlContent = compiledTemplate(data);

  // Email options
  const mailOptions = {
    from: '"Mailgun Sandbox" <postmaster@sandbox309d164a15074658a249d0257c96396f.mailgun.org>',
    to: process.env.EMAIL_FROM,
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.messageId);
  } catch (error) {
    console.error("Error sending email: ", error);
  }
}

module.exports = { sendEmail };
