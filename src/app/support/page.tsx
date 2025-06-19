'use client';
import Image from 'next/image';

export default function SupportPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#fefefe', minHeight: '100vh' }}>
      <header style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fff' }}>
        <Image src={"/icon2.png"} alt="Ramnath Pansari Logo" width={120} height={120} />
        <h1 style={{ fontSize: '2rem', marginTop: '1rem' }}>Customer Support</h1>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          We're here to help! Reach out for any queries or issues with the Ramnath Pansari app.
        </p>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '2rem' }}>
        <h2>📞 Contact Support</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>Email: <a href="mailto:shivam9aug1996@gmail.com">shivam9aug1996@gmail.com</a></li>
          <li>Phone/WhatsApp: <a href="tel:+919634396572">+91-9634396572</a></li>
        </ul>

        <h2>❓ Common Issues</h2>
        <ul>
          <li>Haven’t received your order?</li>
          <li>Facing payment or refund problems?</li>
          <li>App not working as expected?</li>
        </ul>
        <p>Just drop us a message — we’ll respond quickly and resolve the issue.</p>
      </main>

      <footer style={{ textAlign: 'center', padding: '1rem', fontSize: '0.85rem', color: '#888' }}>
        © {new Date().getFullYear()} Ramnath Pansari. All rights reserved.
      </footer>
    </div>
  );
}
