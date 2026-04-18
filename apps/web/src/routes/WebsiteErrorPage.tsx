import WebsiteStatusPage from "../components/public/WebsiteStatusPage";

export default function WebsiteErrorPage() {
  return (
    <WebsiteStatusPage
      eyebrow="Page Unavailable"
      code="Error"
      title="Something interrupted this page, but not your next step."
      description="An unexpected error prevented this page from loading normally. Try the page again, return to the homepage, or contact support if the issue continues."
      actions={[
        { label: "Try Again", onClick: () => window.location.reload() },
        { label: "Return Home", href: "/", variant: "secondary", preserveQuery: true },
        { label: "Contact Support", href: "/contact", variant: "secondary", preserveQuery: true },
      ]}
    />
  );
}
