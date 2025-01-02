import React from "react";

const DeleteAccountInstructions = () => {
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>How to Delete Your Account</h2>
      <p>
        To delete your account, sign in to the app and navigate to the{" "}
        <strong>Profile</strong> section. There, you will find an option labeled{" "}
        <strong>"Delete Account"</strong>. Click on it to proceed with the
        deletion process.
      </p>
      <div>
        <p>Please note:</p>
        <ul style={{ textAlign: "left" }}>
          <li>Deleting your account is permanent and cannot be undone.</li>
          <li>
            All your data, including your purchase history and preferences, will
            be permanently erased.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DeleteAccountInstructions;
