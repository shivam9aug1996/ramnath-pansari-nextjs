'use client';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#fff', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', padding: '2rem' }}>
        <Image src={"/icon2.png"} alt="Ramnath Pansari Logo" width={100} height={100} />
        <h1 style={{ fontSize: '2rem', marginTop: '1rem' }}>Privacy Policy</h1>
      </header>

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', lineHeight: '1.7' }}>
        <p><strong>Effective Date:</strong> June 19, 2025</p>

        <p>
          At <strong>Ramnath Pansari</strong>, we value your privacy and are committed to protecting your personal
          information. This policy explains how we collect, use, and protect the data you provide when using our app or website.
        </p>

        <h2>1. What Information We Collect</h2>
        <ul>
          <li><strong>Mobile Number:</strong> Required to log in or sign up using OTP.</li>
          <li><strong>User Name:</strong> Collected during sign-up or profile setup.</li>
          <li><strong>OTP Verification:</strong> OTPs are sent via Twilio SMS gateway.</li>
          <li><strong>JWT Token:</strong> Generated after successful login to authenticate further requests securely.</li>
          <li><strong>Delivery Information:</strong> Address, location, order preferences.</li>
          <li><strong>Device & App Info:</strong> Device model, usage analytics, IP address.</li>
        </ul>

        <h2>2. How We Use Your Data</h2>
        <ul>
          <li>To verify your identity using OTP (via Twilio).</li>
          <li>To authenticate your session using secure JWT tokens.</li>
          <li>To deliver groceries and other items to your address.</li>
          <li>To personalize your shopping experience (like name, past orders).</li>
          <li>To improve the app based on usage patterns and feedback.</li>
        </ul>

        <h2>3. Data Sharing and Security</h2>
        <p>
          We do <strong>not sell or rent</strong> your personal data. We only share limited information with:
        </p>
        <ul>
          <li>Our SMS service provider (Twilio) for OTP delivery</li>
          <li>Delivery personnel for fulfilling orders</li>
          <li>Payment providers if a transaction is made</li>
        </ul>
        <p>Your data is securely stored and encrypted where appropriate.</p>

        <h2>4. Your Rights</h2>
        <p>
          You can request to update or delete your account or data by contacting us. You may also revoke access at any time.
        </p>

        <h2>5. Children’s Privacy</h2>
        <p>We do not knowingly collect data from users under 13 years of age.</p>

        <h2>6. Changes to This Policy</h2>
        <p>
          We may occasionally update this policy. Significant changes will be posted on this page with an updated date.
        </p>

        <h2>7. Contact Us</h2>
        <p>If you have any questions or concerns:</p>
        <ul>
          <li>Email: <a href="mailto:shivam9aug1996@gmail.com">shivam9aug1996@gmail.com</a></li>
          <li>Phone: <a href="tel:+919634396572">+91-9634396572</a></li>
        </ul>
      </main>

      <footer style={{ textAlign: 'center', padding: '1rem', fontSize: '0.85rem', color: '#888' }}>
        © {new Date().getFullYear()} Ramnath Pansari. All rights reserved.
      </footer>
    </div>
  );
}
