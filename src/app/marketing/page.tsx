'use client';
import Image from 'next/image';

export default function MarketingPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      <header style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fff' }}>
        <Image src={"/icon2.png"} alt="Ramnath Pansari Logo" width={120} height={120} />
        <h1 style={{ fontSize: '2rem', marginTop: '1rem' }}>Ramnath Pansari – Your Instant Grocery Partner</h1>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          Get daily grocery essentials delivered to your door in just 30 minutes!
        </p>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '2rem' }}>
        <h2>🛒 What You Can Shop:</h2>
        <ul>
          <li><strong>Staples:</strong> Rice, wheat flour, pulses, oils, and ghee</li>
          <li><strong>Masale & Spices:</strong> Premium hand-picked masalas</li>
          <li><strong>Packaged Food:</strong> Namkeen, biscuits, instant snacks</li>
          <li><strong>Daily Essentials:</strong> Tea, sugar, salt, soaps, and more</li>
        </ul>

        <h2>⚡ Key Features:</h2>
        <ul>
          <li><strong>30-min Delivery:</strong> Superfast delivery guaranteed</li>
          <li><strong>Smart Navigation:</strong> Find what you need, quickly</li>
          <li><strong>Secure Checkout:</strong> UPI, COD, cards — all supported</li>
          <li><strong>Reordering:</strong> One-tap repeat of past purchases</li>
        </ul>

        <h2>📬 Contact</h2>
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
