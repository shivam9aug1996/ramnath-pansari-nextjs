import React from "react";

const PrivacyPolicy = () => {
  const effectiveDate = "25 Dec 2024";
  const companyName = "Ramnath Pansari";
  const contactEmail = "shivam9aug1996@gmail.com";
  const contactPhoneNumber = "+91 9634396572";
  const contactAddress =
    "942, Ramnath Pansari, krishan ganj, pilkhuwa, hapur, Uttar Pradesh, India, 245304";

  return (
    <div className="p-6 bg-gray-50 text-gray-800 font-sans">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="mb-4">
        <strong>Effective Date:</strong> {effectiveDate}
      </p>

      <p className="mb-4">
        <strong>{companyName}</strong> (“we,” “our,” or “us”) values your trust
        and is committed to protecting your privacy. This Privacy Policy
        explains how we collect, use, disclose, and protect your information
        when you use our services (“Services”), including our mobile app and
        website.
      </p>
      <p className="mb-6">
        By using our Services, you agree to the collection and use of
        information in accordance with this Privacy Policy. If you do not agree,
        please do not use our Services.
      </p>

      <h2 className="text-2xl font-semibold mb-2">1. Information We Collect</h2>
      <h3 className="text-xl font-semibold mb-2">1.1 Personal Information</h3>
      <p className="mb-4">
        We collect the following personal information from you:
      </p>
      <ul className="list-disc list-inside mb-6">
        <li>
          <strong>Profile Photo:</strong> We ask users to upload a profile
          photo, which we store securely in our database.
        </li>
        <li>
          <strong>Location Data:</strong> We request permission to access your
          location to help you save your current address for order delivery.
        </li>
      </ul>

      <h3 className="text-xl font-semibold mb-2">
        1.2 Permissions and Device Data
      </h3>
      <p className="mb-4">
        To provide an optimal experience, we may request the following
        permissions:
      </p>
      <ul className="list-disc list-inside mb-6">
        <li>
          <strong>Location Permissions:</strong> For saving delivery addresses
          and improving location-based services.
        </li>
        <li>
          <strong>Push Notifications:</strong> To send updates about orders,
          promotions, and important announcements.
        </li>
        <li>
          <strong>Storage Permissions:</strong> To allow you to upload profile
          photos and access files if necessary.
        </li>
      </ul>

      <h3 className="text-xl font-semibold mb-2">
        1.3 Automatically Collected Data
      </h3>
      <p className="mb-4">
        We may collect certain information automatically, such as:
      </p>
      <ul className="list-disc list-inside mb-6">
        <li>Device type and operating system.</li>
        <li>Usage statistics related to our app and website.</li>
        <li>IP address and browser type.</li>
      </ul>

      <h2 className="text-2xl font-semibold mb-2">
        2. How We Use Your Information
      </h2>
      <p className="mb-4">We use the information we collect to:</p>
      <ul className="list-disc list-inside mb-6">
        <li>Provide, operate, and improve our Services.</li>
        <li>Facilitate order delivery and maintain user profiles.</li>
        <li>Send push notifications and important updates.</li>
        <li>Ensure the security and functionality of our Services.</li>
      </ul>

      <h2 className="text-2xl font-semibold mb-2">
        3. How We Share Your Information
      </h2>
      <p className="mb-4">
        We do not sell your personal information to third parties. We may share
        your information with:
      </p>
      <ul className="list-disc list-inside mb-6">
        <li>
          <strong>Service Providers:</strong> To perform tasks on our behalf
          (e.g., payment processing, order delivery).
        </li>
        <li>
          <strong>Legal Obligations:</strong> If required by law or in response
          to legal processes.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mb-2">4. Data Security</h2>
      <p className="mb-6">
        We implement appropriate technical and organizational measures to
        protect your information from unauthorized access, use, or disclosure.
        However, no system is completely secure, and we cannot guarantee the
        absolute security of your data.
      </p>

      <h2 className="text-2xl font-semibold mb-2">
        5. Your Choices and Rights
      </h2>
      <ul className="list-disc list-inside mb-6">
        <li>
          <strong>Manage Permissions:</strong> You can manage app permissions in
          your device settings.
        </li>
        <li>
          <strong>Access and Update Information:</strong> You can update your
          profile photo and address within the app.
        </li>
        <li>
          <strong>Opt-Out:</strong> You can opt out of push notifications
          through your device settings.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mb-2">6. Children’s Privacy</h2>
      <p className="mb-6">
        Our Services are not intended for children under the age of 13. We do
        not knowingly collect personal information from children.
      </p>

      <h2 className="text-2xl font-semibold mb-2">
        7. Changes to This Privacy Policy
      </h2>
      <p className="mb-6">
        We may update this Privacy Policy from time to time. Changes will be
        notified through the app or website. Your continued use of our Services
        after such updates signifies your acceptance of the new terms.
      </p>

      <h2 className="text-2xl font-semibold mb-2">8. Contact Us</h2>
      <p className="mb-4">
        If you have any questions or concerns about this Privacy Policy, please
        contact us at:
      </p>
      <address className="not-italic mb-6">
        <strong>{companyName}</strong>
        <br />
        {contactEmail}
        <br />
        {contactPhoneNumber}
        <br />
        {contactAddress}
      </address>
    </div>
  );
};

export default PrivacyPolicy;
