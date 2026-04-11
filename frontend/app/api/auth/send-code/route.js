import { NextResponse } from "next/server";
import { setOTP } from "@/lib/otpStore";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP
    setOTP(email, code);

    // Send email using Nodemailer if credentials are provided
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Configured for Gmail by default if SMTP_HOST is not provided
        const transporterConfig = process.env.SMTP_HOST ? {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        } : {
          service: "gmail",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS, // Use Gmail App Password here
          }
        };

        const transporter = nodemailer.createTransport(transporterConfig);
        
        await transporter.sendMail({
          from: `"SentinelIQ" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "Your SentinelIQ Login Code",
          text: `Your login code is: ${code}`,
          html: `<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #09090b; color: #ffffff;">
            <div style="max-w: 400px; margin: 0 auto; border: 1px solid #27272a; border-radius: 12px; padding: 30px; text-align: center;">
                <h2 style="margin-top: 0; color: #ffffff;">SentinelIQ Verification</h2>
                <p style="color: #a1a1aa;">Your 6-digit access code is:</p>
                <h1 style="color: #10b981; letter-spacing: 8px; font-family: monospace; font-size: 36px; margin: 20px 0;">${code}</h1>
                <p style="color: #a1a1aa; font-size: 12px;">This code will expire in 5 minutes.</p>
            </div>
          </div>`,
        });
        console.log("OTP Email sent to", email);
        return NextResponse.json({ message: "Code sent successfully", isLocal: false });
    } else {
        // Fallback to console log to prevent ECONNRESET from Ethereal
        console.log("\n=========================================");
        console.log(`[LOCAL DEV] OTP for ${email} is: ${code}`);
        console.log("Set SMTP_USER and SMTP_PASS in .env.local to use Gmail SMTP.");
        console.log("=========================================\n");
        return NextResponse.json({ message: "Code sent successfully", isLocal: true });
    }

  } catch (error) {
    console.error("Error sending code:", error);
    return NextResponse.json({ error: "Failed to send email. Check your SMTP configuration." }, { status: 500 });
  }
}