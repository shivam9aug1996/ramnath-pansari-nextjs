import Footer from "./Footer";
import Header from "./Header";


interface PageWrapperProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

export default function PageWrapper({
  children,
  showHeader = true,
  showFooter = true,
}: PageWrapperProps) {
  return (
    <>
      {showHeader && <Header />}
      {children}
      {showFooter && <Footer />}
    </>
  );
} 