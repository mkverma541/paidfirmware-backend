const fs = require("fs").promises;
const path = require("path");
const Handlebars = require("handlebars");
const { pool } = require("../config/database.js");

const nodemailer = require("nodemailer");

// Create a transporter object with your email service provider's SMTP settings
const transporter = nodemailer.createTransport({
  host: "premium119.web-hosting.com",
  port: 587,
  secure: false, // Use true when port is 465
  auth: {
    user: "info@mathematicalpathshala.in",
    pass: "Y0(2o@9n=U$B",
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});

// Security: Validate file paths and extensions
const isValidPartialFile = (file) => {
  const validExtensions = [".html"];
  const ext = path.extname(file).toLowerCase();
  return validExtensions.includes(ext);
};

// Register partials with Handlebars
async function registerPartials() {
  try {
    const partialsDir = path.join(process.cwd(), "emails", "partials");

    // Verify directory exists
    await fs.access(partialsDir);

    const files = await fs.readdir(partialsDir);

    for (const file of files) {
      if (!isValidPartialFile(file)) continue;

      const filePath = path.join(partialsDir, file);
      const content = await fs.readFile(filePath, "utf8");
      const partialName = path.basename(file, ".html");
      Handlebars.registerPartial(partialName, content);
    }
  } catch (error) {
    console.error("Error registering partials:", error);
    throw error; // Re-throw to handle in calling function
  }
}

// Get site settings from database
async function getSiteSettings() {
  try {
    // get data from public data -> settings.json file

    const settingsFilePath = path.join(
      process.cwd(),
      "public",
      "data",
      "settings.json"
    );
    const settingsFile = await fs.readFile(settingsFilePath, "utf8");
    const settings = JSON.parse(settingsFile);

    return settings; // Return settings object
  } catch (error) {
    console.error("Error reading settings file:", error);
    throw error;
  }
}

// Compile and render email template
async function renderEmail(templateName, data = {}) {
  try {
    await registerPartials();
    const siteSettings = await getSiteSettings();

    // Validate template name to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(templateName)) {
      throw new Error("Invalid template name");
    }

    const layoutPath = path.join(
      process.cwd(),
      "emails",
      "layouts",
      "main-layout.html"
    );
    const templatePath = path.join(
      process.cwd(),
      "emails",
      "templates",
      `${templateName}.html`
    );

    // Read files in parallel
    const [layoutSource, templateSource] = await Promise.all([
      fs.readFile(layoutPath, "utf8"),
      fs.readFile(templatePath, "utf8"),
    ]);

    const layoutTemplate = Handlebars.compile(layoutSource);
    const contentTemplate = Handlebars.compile(templateSource);

    const combinedData = {
      ...data,
      siteName: siteSettings.site_name || "Company Name",
      logoUrl: siteSettings.logo
        ? `${process.env.MEDIA_URL}/${siteSettings.logo}`
        : "https://via.placeholder.com/150x50",
      primaryColor: siteSettings.primary_color || "#f27a24",
      currentYear: new Date().getFullYear(),
    };
    const content = contentTemplate(combinedData);
    return layoutTemplate({ ...combinedData, content });
  } catch (error) {
    console.error("Error rendering email:", error);
    throw error;
  }
}

async function sendEmail(email, subject, templateName, data) {
  try {
    if (!email || !subject || !templateName) {
      throw new Error("Missing required parameters");
    }

    const emailHtml = await renderEmail(templateName, data);

    const mailOptions = {
      from: "info@mathematicalpathshala.in",
      to: email,
      subject: subject,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        throw error;
      }
      console.log("Email sent: ", info.response);
    });

    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error generating email:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
};
