import React from "react";

const Header = () => {
  return (
    <header style={styles.header}>
      <h1 style={styles.title}>Ramnath Pansari</h1>
      <nav style={styles.nav}>
        <a href="/" style={styles.link}>
          Home
        </a>
      </nav>
    </header>
  );
};

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    backgroundColor: "#4CAF50",
    color: "#fff",
  },
  title: {
    margin: 0,
  },
  nav: {
    display: "flex",
    gap: "15px",
  },
  link: {
    color: "#fff",
    textDecoration: "none",
    fontWeight: "bold",
  },
};

export default Header;
