const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Load the email template
const emailTemplatePath = path.join(__dirname, '../', 'email-templates', 'test.html');
const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf-8');

// Create a transporter object with your email service provider's SMTP settings
const transporter = nodemailer.createTransport({
  host: 'server209.web-hosting.com',
  port: 587,
  secure: true, // Use true when port is 465
  auth: {
    user: 'contact@mathematicalpathshala.in',
    pass: 'Talbros@1994',
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});

async function sendEmail(req, res) {
  const { to, subject, username } = req.body;

  // Replace template placeholders with actual data
  const html = emailTemplate.replace('{{username}}', username);

  // Setup email data
  const mailOptions = {
    from: 'mathematicalpathshala@gmail.com',
    to,
    subject,
    html,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', to);
    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { sendEmail };
