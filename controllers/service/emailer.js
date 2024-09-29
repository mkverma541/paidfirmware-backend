const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Load the email template
// const emailTemplatePath = path.join(__dirname, '../', 'email-templates', 'test.html');
// const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf-8');

// Create a transporter object with your email service provider's SMTP settings
const transporter = nodemailer.createTransport({
  host: 'premium119.web-hosting.com',
  port: 587,
  secure: false, // Use true when port is 465
  auth: {
    user: 'info@mathematicalpathshala.in',
    pass: 'Y0(2o@9n=U$B',
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});


const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: 'info@mathematicalpathshala.in',
    to,          // Use the 'to' email argument directly
    subject,     // Use the 'subject' argument
    html,        // Use the 'html' content argument
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return reject(error);
      }
      console.log('Email sent: ', info.response);
      resolve(info);
    });
  });
};

module.exports = { sendEmail };
