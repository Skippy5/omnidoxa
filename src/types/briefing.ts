/**
 * Type definitions for OmniDoxa Briefing System
 * 
 * Shared types for briefing configuration, templates, and layouts
 */

// ===== CONFIGURATION TYPES =====

export interface WeatherConfig {
  enabled: boolean;
  location: string;
}

export interface MarketConfig {
  enabled: boolean;
}

export interface Stock {
  symbol: string;
  name: string;
}

export interface StocksConfig {
  enabled: boolean;
  watchlist: Stock[];
}

export interface NewsTopic {
  heading: string;
}

export interface NewsConfig {
  enabled: boolean;
  topics: NewsTopic[];
}

export interface PersonalConfig {
  name: string;
  email: string;
  membershipLevel?: 'free' | 'basic' | 'premium';
}

export interface SmartBriefingConfig {
  enabled: boolean;
  topic: string;
}

export interface DeliveryConfig {
  enabled: boolean;
  time: string;
}

export interface BriefingConfig {
  weather: WeatherConfig;
  market: MarketConfig;
  stocks: StocksConfig;
  news: NewsConfig;
  personal: PersonalConfig;
  smartBriefing?: SmartBriefingConfig;
  delivery: DeliveryConfig;
}

// ===== TEMPLATE TYPES =====

export interface ColorScheme {
  gradient: string;
  primary: string;
}

export interface WeatherData {
  temperature: number;
  weatherDescription: string;
  windSpeed: number;
  windDirection: string;
  forecast?: Array<{
    dayName: string;
    high: number;
    low: number;
    weatherDescription: string;
  }>;
}

export interface NewsArticle {
  title: string;
  description?: string;
  url: string;
  source?: string;
}

export interface StockData {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  outlook?: string;
  error?: boolean;
}

export interface FutureData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  error?: boolean;
}

export interface Quote {
  text?: string;
  quote?: string;
  author?: string;
}

export interface Task {
  title?: string;
}

export interface BriefingSection {
  type: 'weather' | 'news' | 'stocks' | 'quote' | 'tasks' | 'grok' | 'html' | 'generic';
  title?: string;
  content?: any;
}

export interface BriefingTemplateConfig {
  recipientName?: string;
  greeting?: string;
  date?: string;
  time?: string;
  headerGradient?: string;
  sections?: BriefingSection[];
  footer?: string;
  customStyles?: string;
}
