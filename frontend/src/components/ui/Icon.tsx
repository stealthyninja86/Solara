import {
  BarChart3,
  BarChart2,
  TrendingUp,
  Tags,
  Brain,
  Repeat,
  Wallet,
  Target,
  ArrowDownRight,
  CircleDot,
  List,
  CheckCircle,
  Eye,
  Tag,
  FileText,
  AlertTriangle,
  Settings,
  Lightbulb,
  Upload,
  Plus,
  Home,
  PieChart,
  CreditCard,
  Sun,
  FlaskConical,
  LogOut,
  type LucideProps,
} from "lucide-react";
import { useIconMode } from "../../hooks/useIconMode";

const EMOJI_MAP: Record<string, string> = {
  "financial-snapshot": "\uD83D\uDCCA",
  "spending-behaviour": "\uD83D\uDCCA",
  "spending-trend": "\uD83D\uDCC8",
  "category-breakdown": "\uD83C\uDFF7\uFE0F",
  "solara-insights": "\uD83E\uDD16",
  "recurring-payments": "\uD83D\uDD04",
  income: "\uD83D\uDCB0",
  budget: "\uD83C\uDFAF",
  spending: "\uD83D\uDCB8",
  "top-expenses": "\uD83D\uDD35",
  transactions: "\uD83D\uDCCB",
  "transaction-submitted": "\u2705",
  "review-transaction": "\uD83D\uDC40",
  "categorize-transaction": "\uD83C\uDFF7\uFE0F",
  "transaction-details": "\uD83D\uDCCB",
  "budget-exceeded": "\u26A0\uFE0F",
  settings: "\u2699\uFE0F",
  tip: "\uD83D\uDCA1",
  import: "\uD83D\uDCC4",
  add: "\u270F\uFE0F",
  home: "\uD83C\uDFE0",
  reports: "\uD83D\uDCCA",
  "safe-to-spend": "\uD83D\uDCB8",
  "ai-insights": "\uD83E\uDD16",
  "monthly-income": "\uD83D\uDCB0",
  "total-expenses": "\uD83D\uDCB0",
  "savings-rate": "\uD83D\uDCB0",
  "set-income": "\uD83D\uDCB0",
  "update-income": "\uD83D\uDCB0",
  "set-budget": "\uD83C\uDFAF",
  "update-budget": "\uD83C\uDFAF",
  "no-income": "\uD83D\uDCB0",
  "no-budget": "\uD83C\uDFAF",
  "no-spending": "\uD83D\uDCB8",
  "close": "\u2715",
  "previous": "\u2190",
  "next": "\u2192",
  "back-to-home": "\u2190",
  "logo": "\u2600\uFE0F",
  "overview": "\uD83C\uDFE0",
  "preview": "\uD83E\uDDEA",
  "success": "\u2705",
  "greeting": "\uD83D\uDC4B",
  "logout": "\uD83D\uDEAA",
};

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  "financial-snapshot": BarChart3,
  "spending-behaviour": BarChart2,
  "spending-trend": TrendingUp,
  "category-breakdown": Tags,
  "solara-insights": Brain,
  "recurring-payments": Repeat,
  income: Wallet,
  budget: Target,
  spending: ArrowDownRight,
  "top-expenses": CircleDot,
  transactions: List,
  "transaction-submitted": CheckCircle,
  "review-transaction": Eye,
  "categorize-transaction": Tag,
  "transaction-details": FileText,
  "budget-exceeded": AlertTriangle,
  settings: Settings,
  tip: Lightbulb,
  import: Upload,
  add: Plus,
  home: Home,
  reports: PieChart,
  "safe-to-spend": CreditCard,
  "ai-insights": Brain,
  "monthly-income": Wallet,
  "total-expenses": CreditCard,
  "savings-rate": TrendingUp,
  "set-income": Wallet,
  "update-income": Wallet,
  "set-budget": Target,
  "update-budget": Target,
  "no-income": Wallet,
  "no-budget": Target,
  "no-spending": CreditCard,
  "close": () => null,
  "previous": () => null,
  "next": () => null,
  "back-to-home": () => null,
  "logo": Sun,
  "overview": Home,
  "preview": FlaskConical,
  "success": CheckCircle,
  "greeting": () => null,
  "logout": LogOut,
};

const ICON_COLORS: Record<string, string> = {
  "financial-snapshot": "#6366f1",
  "spending-behaviour": "#8b5cf6",
  "spending-trend": "#06b6d4",
  "category-breakdown": "#f59e0b",
  "solara-insights": "#a78bfa",
  "recurring-payments": "#f97316",
  income: "#22c55e",
  budget: "#3b82f6",
  spending: "#ef4444",
  "top-expenses": "#6366f1",
  transactions: "#64748b",
  "transaction-submitted": "#22c55e",
  "review-transaction": "#8b5cf6",
  "categorize-transaction": "#f59e0b",
  "transaction-details": "#64748b",
  "budget-exceeded": "#ef4444",
  settings: "#64748b",
  tip: "#f59e0b",
  import: "#0ea5e9",
  add: "#22c55e",
  home: "#6366f1",
  reports: "#8b5cf6",
  "safe-to-spend": "#22c55e",
  "ai-insights": "#a78bfa",
  "monthly-income": "#22c55e",
  "total-expenses": "#ef4444",
  "savings-rate": "#06b6d4",
  "set-income": "#22c55e",
  "update-income": "#22c55e",
  "set-budget": "#3b82f6",
  "update-budget": "#3b82f6",
  "no-income": "#64748b",
  "no-budget": "#64748b",
  "no-spending": "#64748b",
  "logo": "#f59e0b",
  overview: "#6366f1",
  preview: "#8b5cf6",
  success: "#22c55e",
  greeting: "#f59e0b",
  logout: "#ef4444",
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}

export function Icon({ name, size = 16, className, color }: IconProps) {
  const { isEmoji } = useIconMode();

  if (isEmoji) {
    const emoji = EMOJI_MAP[name];
    if (!emoji) return null;
    return (
      <span className={className} style={{ fontSize: size }}>
        {emoji}
      </span>
    );
  }

  const LucideIcon = ICON_MAP[name];
  if (!LucideIcon) return null;
  const iconColor = color || ICON_COLORS[name];
  return <LucideIcon size={size} className={className} color={iconColor} style={{ color: iconColor }} />;
}
