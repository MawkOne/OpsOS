"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Currency = "USD" | "CAD";

interface ExchangeRates {
  USD: number;
  CAD: number;
  lastUpdated: Date;
}

interface HistoricalRate {
  rate: number;
  date: string; // YYYY-MM format
}

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  exchangeRates: ExchangeRates | null;
  convertAmount: (amount: number, fromCurrency: Currency) => number;
  convertAmountHistorical: (amount: number, fromCurrency: Currency, monthKey: string) => number;
  formatAmount: (amount: number, sourceCurrency?: Currency) => string;
  getExchangeRateDisplay: () => { usdToCad: string; cadToUsd: string };
  getHistoricalRate: (monthKey: string) => Promise<number>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>("CAD");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicalRates, setHistoricalRates] = useState<Map<string, number>>(new Map());

  // Load currency preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("preferredCurrency");
    if (saved === "USD" || saved === "CAD") {
      setSelectedCurrencyState(saved);
    }
  }, []);

  // Fetch exchange rates from ratesdb.com
  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Fetch USD and CAD rates (base is EUR by default)
        const response = await fetch("https://ratesdb.com/api/latest?base=USD&currencies=CAD");
        const data = await response.json();
        
        if (data && data.rates) {
          setExchangeRates({
            USD: 1, // Base currency
            CAD: data.rates.CAD || 1.35, // Fallback to approximate rate
            lastUpdated: new Date(),
          });
        }
      } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        // Fallback to approximate rates
        setExchangeRates({
          USD: 1,
          CAD: 1.35,
          lastUpdated: new Date(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    // Refresh rates daily
    const interval = setInterval(fetchRates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Pre-fetch historical rates for the last 12 months on mount
  useEffect(() => {
    if (!exchangeRates) return;

    const prefetchHistoricalRates = async () => {
      const now = new Date();
      const monthsToFetch: string[] = [];

      // Generate last 12 months
      for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        monthsToFetch.push(monthKey);
      }

      // Fetch all historical rates in parallel
      await Promise.all(monthsToFetch.map(month => getHistoricalRate(month)));
    };

    prefetchHistoricalRates();
  }, [exchangeRates]);

  // Save currency preference
  const setSelectedCurrency = (currency: Currency) => {
    setSelectedCurrencyState(currency);
    localStorage.setItem("preferredCurrency", currency);
  };

  // Convert amount from one currency to selected currency
  const convertAmount = (amount: number, fromCurrency: Currency): number => {
    if (!exchangeRates || fromCurrency === selectedCurrency) return amount;

    if (fromCurrency === "USD" && selectedCurrency === "CAD") {
      return amount * exchangeRates.CAD;
    } else if (fromCurrency === "CAD" && selectedCurrency === "USD") {
      return amount / exchangeRates.CAD;
    }

    return amount;
  };

  // Format amount in selected currency
  const formatAmount = (amount: number, sourceCurrency: Currency = selectedCurrency): string => {
    const convertedAmount = convertAmount(amount, sourceCurrency);
    const locale = selectedCurrency === "USD" ? "en-US" : "en-CA";
    
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: selectedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertedAmount);
  };

  // Fetch historical exchange rate for a specific month
  const getHistoricalRate = async (monthKey: string): Promise<number> => {
    // Check cache first
    if (historicalRates.has(monthKey)) {
      return historicalRates.get(monthKey)!;
    }

    try {
      // Parse month key (e.g., "2024-01" or "2024")
      let dateStr: string;
      if (monthKey.length === 4) {
        // Year only - use Dec 31st of that year
        dateStr = `${monthKey}-12-31`;
      } else {
        // Month format - use last day of that month
        const [year, month] = monthKey.split('-');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        dateStr = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
      }

      // Fetch historical rate from exchangerate-api.com (free, no key required)
      const response = await fetch(`https://api.exchangerate-api.com/v4/history/USD/${dateStr}`);
      
      if (response.ok) {
        const data = await response.json();
        const rate = data.rates?.CAD || exchangeRates?.CAD || 1.35;
        
        // Cache the rate
        setHistoricalRates(prev => new Map(prev).set(monthKey, rate));
        return rate;
      } else {
        // Fallback to current rate if API fails
        return exchangeRates?.CAD || 1.35;
      }
    } catch (error) {
      console.error(`Failed to fetch historical rate for ${monthKey}:`, error);
      // Fallback to current rate
      return exchangeRates?.CAD || 1.35;
    }
  };

  // Convert amount using historical exchange rate for specific month
  const convertAmountHistorical = (amount: number, fromCurrency: Currency, monthKey: string): number => {
    if (fromCurrency === selectedCurrency) return amount;

    // For real-time conversion or if no month specified, use current rate
    if (!monthKey) {
      return convertAmount(amount, fromCurrency);
    }

    // Get cached historical rate (will be fetched async if not in cache)
    const historicalRate = historicalRates.get(monthKey) || exchangeRates?.CAD || 1.35;

    if (fromCurrency === "USD" && selectedCurrency === "CAD") {
      return amount * historicalRate;
    } else if (fromCurrency === "CAD" && selectedCurrency === "USD") {
      return amount / historicalRate;
    }

    return amount;
  };

  // Get exchange rate display strings (both directions)
  const getExchangeRateDisplay = (): { usdToCad: string; cadToUsd: string } => {
    if (!exchangeRates) return { usdToCad: "", cadToUsd: "" };

    const usdToCadRate = exchangeRates.CAD.toFixed(4);
    const cadToUsdRate = (1 / exchangeRates.CAD).toFixed(4);

    return {
      usdToCad: `1 USD = ${usdToCadRate} CAD`,
      cadToUsd: `1 CAD = ${cadToUsdRate} USD`,
    };
  };

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        exchangeRates,
        convertAmount,
        convertAmountHistorical,
        formatAmount,
        getExchangeRateDisplay,
        getHistoricalRate,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
