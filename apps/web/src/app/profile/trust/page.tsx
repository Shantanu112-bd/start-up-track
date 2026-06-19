"use client";

import React, { useState } from "react";
import { useAppStore } from "../../../lib/store";

export default function TrustCenterPage() {
  const { clearTokens } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/users/me/export`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "cryptopay-data-export.json";
        a.click();
        URL.revokeObjectURL(downloadUrl);
      } else {
        alert("Failed to export data");
      }
    } catch (e) {
      console.error(e);
      alert("Error exporting data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/users/me`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        clearTokens();
        window.location.href = "/";
      } else {
        alert("Failed to delete account");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting account");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Trust & Security Center</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
        <h2 className="text-xl font-semibold mb-2">Export Your Data</h2>
        <p className="text-gray-600 mb-4">
          Download a complete copy of all your data including profile information, wallets, and transaction history.
        </p>
        <button 
          onClick={handleExportData} 
          disabled={isExporting}
          className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Download JSON Archive"}
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-red-100 mb-6">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Danger Zone</h2>
        <p className="text-gray-600 mb-4">
          Permanently delete your account and all associated data. This action is irreversible.
        </p>
        <button 
          onClick={handleDeleteAccount} 
          disabled={isDeleting}
          className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}
