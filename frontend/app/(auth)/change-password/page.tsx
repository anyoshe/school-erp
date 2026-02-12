"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/utils/api";
import { toast } from "sonner";

export default function ChangePassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstTime = searchParams.get("first") === "true";

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (!isFirstTime && !oldPassword) {
      toast.error("Current password is required");
      return;
    }

    setLoading(true);
    try {
      await api.post("/accounts/change-password/", {
        old_password: oldPassword || "temporary",  // Use a placeholder if first time
        new_password: newPassword,
      });

      toast.success("Password updated successfully!");
      router.replace("/dashboard");
    } catch (err: any) {
      const message =
        err.response?.data?.old_password?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Failed to update password. Please try again.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
          {isFirstTime ? "Set Your First Password" : "Change Password"}
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {isFirstTime
            ? "Your account was created with a temporary password. Set a new secure password to access the system."
            : "Update your password for security"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isFirstTime && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password *
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="••••••••"
                required={!isFirstTime}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isFirstTime ? "New Password" : "New Password"} *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="••••••••"
              required
            />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all ${
              loading
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
                Updating...
              </span>
            ) : (
              isFirstTime ? "Set Password & Continue" : "Update Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}