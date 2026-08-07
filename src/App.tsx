import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/AppLayout";
import Roles from "./pages/Roles";
import ResumeProfile from "./pages/ResumeProfile";

import Applications from "./pages/Applications";
import Networking from "./pages/Networking";
import InterviewPrep from "./pages/InterviewPrep";
import WeeklyReport from "./pages/WeeklyReport";
import RejectionAnalysis from "./pages/RejectionAnalysis";
import GmailCallback from "./pages/GmailCallback";
import LinkedInCallback from "./pages/LinkedInCallback";
import ResetPassword from "./pages/ResetPassword";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/gmail-callback" element={<GmailCallback />} />
          <Route path="/linkedin-callback" element={<LinkedInCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<Roles />} />
            <Route path="applications" element={<Applications />} />
            <Route path="resume" element={<ResumeProfile />} />

            <Route path="networking" element={<Networking />} />
            <Route path="prep" element={<InterviewPrep />} />
            <Route path="report" element={<WeeklyReport />} />
            <Route path="rejection" element={<RejectionAnalysis />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
