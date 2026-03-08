import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";

const GmailCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profileId } = useProfile();
  const { handleOAuthCallback } = useGmailImport(profileId);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const storedState = sessionStorage.getItem("gmail_oauth_state");

    if (error) {
      toast.error(`Gmail connection failed: ${error}`);
      navigate("/dashboard", { replace: true });
      return;
    }

    if (!code) {
      toast.error("No authorization code received");
      navigate("/dashboard", { replace: true });
      return;
    }

    if (state && storedState && state !== storedState) {
      toast.error("OAuth state mismatch — please try again");
      navigate("/dashboard", { replace: true });
      return;
    }

    processed.current = true;
    sessionStorage.removeItem("gmail_oauth_state");

    // Exchange the code and then navigate back
    handleOAuthCallback(code).then(() => {
      navigate("/dashboard", { replace: true });
    });
  }, [searchParams, navigate, handleOAuthCallback]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Connecting Gmail...</p>
      </div>
    </div>
  );
};

export default GmailCallback;
