import PrepSpinner from "./PrepSpinner";

export interface CompanyData {
  companyOverview: string;
  businessModel: string;
  revenueStreams: string;
  recentNews: string[];
  productLaunches: string[];
  aiDirection: string;
  competitiveLandscape: string;
  roleContext: string;
  whyHiring: string;
  talkingPoints: string[];
}

interface Props {
  data: CompanyData | null;
  loading: boolean;
}

const InfoBlock = ({ label, content }: { label: string; content: string }) => (
  <div className="mb-3">
    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
    <p className="text-xs leading-relaxed text-secondary-foreground">{content}</p>
  </div>
);

const CompanyDeepDive = ({ data, loading }: Props) => {
  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Researching company…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1">
        <div className="text-xs font-semibold mb-2">Company Overview</div>
        <InfoBlock label="What they do" content={data.companyOverview} />
        <InfoBlock label="Business Model" content={data.businessModel} />
        <InfoBlock label="Revenue Streams" content={data.revenueStreams} />
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold mb-2">Strategic Context</div>
        {data.recentNews.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Recent News</div>
            <ul className="space-y-1">
              {data.recentNews.map((n, i) => <li key={i} className="text-xs leading-relaxed text-secondary-foreground">• {n}</li>)}
            </ul>
          </div>
        )}
        <InfoBlock label="AI / Tech Direction" content={data.aiDirection} />
        <InfoBlock label="Competitive Landscape" content={data.competitiveLandscape} />
      </div>

      <div className="md:col-span-2 bg-secondary/50 rounded-lg p-4">
        <div className="text-xs font-semibold mb-2">Role Context</div>
        <InfoBlock label="How This Role Fits" content={data.roleContext} />
        <InfoBlock label="Why They're Hiring" content={data.whyHiring} />
      </div>

      <div className="md:col-span-2 bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">🎯 Key Talking Points</div>
        <div className="space-y-2">
          {data.talkingPoints.map((pt, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed">
              <span className="font-bold text-primary shrink-0">{i + 1}.</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompanyDeepDive;
