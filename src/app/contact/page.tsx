'use client';

import Image from "next/image";

export default function ContactPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      <header style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fff' }}>
        <Image src={"/icon2.png"} alt="Ramnath Pansari Logo" width={120} height={120} />
        <h1 style={{ fontSize: '2rem', marginTop: '1rem' }}>Contact Us</h1>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          We'd love to hear from you! Reach out to us using the details below.
        </p>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '2rem' }}>
        <h2>📬 Contact Information</h2>
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
