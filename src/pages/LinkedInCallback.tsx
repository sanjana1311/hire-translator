import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { exchangeLinkedInCode } from "@/hooks/use-linkedin";

const LinkedInCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processed = useRef(false);
  const [message, setMessage] = useState("Connecting LinkedIn…");

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const storedState = sessionStorage.getItem("linkedin_oauth_state");
    sessionStorage.removeItem("linkedin_oauth_state");

    const fail = (msg: string) => {
      setMessage(msg);
      toast.error(msg);
      setTimeout(() => navigate("/dashboard/networking", { replace: true }), 1500);
    };

    if (error) return fail(`LinkedIn authorization denied: ${error}`);
    if (!code) return fail("No authorization code received from LinkedIn.");
    if (state && storedState && state !== storedState) return fail("OAuth state mismatch — please try again.");

    exchangeLinkedInCode(code)
      .then(() => {
        toast.success("LinkedIn connected");
        navigate("/dashboard/networking", { replace: true });
      })
      .catch((e: Error) => fail(e.message));
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default LinkedInCallback;
