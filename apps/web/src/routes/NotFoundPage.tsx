import WebsiteStatusPage from "../components/public/WebsiteStatusPage";

export default function NotFoundPage() {
  return (
    <WebsiteStatusPage
      eyebrow="Page Not Found"
      code="404"
      title="This path doesn't exist... but your next one does."
      description="The link you followed may be outdated, incomplete, or tied to a page that has moved on. You can head back home, explore current sessions, or jump straight into booking from here."
      actions={[
        { label: "Go Home", href: "/", preserveQuery: true },
        { label: "Explore Sessions", href: "/#sessions", variant: "secondary", preserveQuery: true },
        { label: "Book a Session", href: "/sessions", variant: "secondary", preserveQuery: true },
      ]}
    />
  );
}
