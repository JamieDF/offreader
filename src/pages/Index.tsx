import { Navigate } from "react-router-dom";

const Index = () => {
  // Redirect to library - this page is now just a fallback
  return <Navigate to="/" replace />;
};

export default Index;
