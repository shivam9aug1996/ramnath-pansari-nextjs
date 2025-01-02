import React from "react";

const Footer = () => {
  return (
    <footer style={styles.footer}>
      <p style={styles.text}>© 2025 Ramnath Pansari. All rights reserved.</p>
    </footer>
  );
};

const styles = {
  footer: {
    textAlign: "center",
    padding: "20px",
    backgroundColor: "#333",
    color: "#fff",
    marginTop: "auto",
  },
  text: {
    margin: 0,
  },
};

export default Footer;
