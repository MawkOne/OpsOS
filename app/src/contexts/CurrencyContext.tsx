"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Currency = "USD" | "CAD";

interface ExchangeRates {
  USD: number;
  CAD: number;
  lastUpdated: Date;
}

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  exchangeRates: ExchangeRates | null;
  convertAmount: (amount: number, fromCurrency: Currency) => number;
  formatAmount: (amount: number, sourceCurrency?: Currency) => string;
  getExchangeRateDisplay: () => string;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>("CAD");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Get exchange rate display string
  const getExchangeRateDisplay = (): string => {
    if (!exchangeRates) return "";

    if (selectedCurrency === "USD") {
      const rate = (1 / exchangeRates.CAD).toFixed(4);
      return `1 CAD = ${rate} USD`;
    } else {
      const rate = exchangeRates.CAD.toFixed(4);
      return `1 USD = ${rate} CAD`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        exchangeRates,
        convertAmount,
        formatAmount,
        getExchangeRateDisplay,
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
