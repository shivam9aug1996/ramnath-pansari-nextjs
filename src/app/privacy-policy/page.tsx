'use client';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#fff', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', padding: '2rem' }}>
        <Image src="/icon2.png" alt="Ramnath Pansari Logo" width={100} height={100} />
        <h1 style={{ fontSize: '2rem', marginTop: '1rem' }}>Privacy Policy</h1>
      </header>

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', lineHeight: '1.7' }}>
      <p><strong>Effective Date:</strong> July 4, 2025</p>

        <p>
          At <strong>Ramnath Pansari</strong>, we value your privacy and are committed to protecting your personal
          information. This policy explains how we collect, use, and protect the data you provide when using our app or website.
        </p>

        <h2>1. What Information We Collect</h2>
        <ul>
          <li><strong>Mobile Number & User Name:</strong> Collected during sign-up or profile setup.</li>
          <li><strong>Password:</strong> Stored securely using bcrypt hashing (we never store plain text passwords).</li>
          <li><strong>JWT Token:</strong> Used to authenticate your session securely after login.</li>
          <li><strong>Delivery Information:</strong> Your address and current location to deliver orders accurately.</li>
          <li><strong>Location Data:</strong> Used for AI-based personalized messages (e.g., weather-based greetings) and for assigning delivery partners.</li>
          <li><strong>Device & App Info:</strong> Includes device model, usage analytics, and IP address.</li>
        </ul>

        <h2>2. How We Use Your Data</h2>
        <ul>
          <li>To securely log you in using hashed password authentication (bcrypt).</li>
          <li>To authenticate your session via secure JWT tokens.</li>
          <li>To assign delivery partners and deliver items to your correct location.</li>
          <li>To personalize your experience based on your location and weather (AI messages).</li>
          <li>To improve app performance through analytics and usage data.</li>
        </ul>

        <h2>3. Data Sharing and Security</h2>
        <p>
          We do <strong>not sell or rent</strong> your personal data. We only share limited information with:
        </p>
        <ul>
          <li>Delivery personnel (to fulfill orders)</li>
          <li>Payment providers (if you make a transaction)</li>
        </ul>
        <p><strong>Security Practices:</strong></p>
        <ul>
          <li>Passwords are hashed using bcrypt — not stored in plain text.</li>
          <li>All API communication is secured over HTTPS.</li>
          <li>Location data is stored only when needed and protected securely.</li>
        </ul>

        <h2>4. Your Rights</h2>
        <p>
          You can update or delete your account information anytime from the app. You may also revoke app permissions through your device settings.
        </p>

        <h2>5. Children’s Privacy</h2>
        <p>We do not knowingly collect data from users under 13 years of age.</p>

        <h2>6. Changes to This Policy</h2>
        <p>
          We may occasionally update this policy. Significant changes will be posted here with a new effective date.
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
