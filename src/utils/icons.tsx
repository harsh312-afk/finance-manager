import React from 'react';
import {
  Home,
  Utensils,
  Car,
  Film,
  Zap,
  HeartPulse,
  ShoppingBag,
  Sparkles,
  Briefcase,
  Tag,
  CreditCard,
  PiggyBank,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  HelpCircle
} from 'lucide-react';

export function getCategoryIcon(name?: string, className: string = "w-5 h-5") {
  switch (name) {
    case 'Home':
      return <Home className={className} />;
    case 'Utensils':
      return <Utensils className={className} />;
    case 'Car':
      return <Car className={className} />;
    case 'Film':
      return <Film className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'HeartPulse':
      return <HeartPulse className={className} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    default:
      return <Tag className={className} />;
  }
}
