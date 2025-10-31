"use client";

import React, { useState, useEffect } from "react";
import { useDraftStorage } from "@/hooks/use-draft-storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Undo2 } from "lucide-react";

/**
 * Mock Test Page for Draft Auto-Save Feature
 * 
 * This page allows testing the draft auto-save functionality without
 * needing a full LangSmith setup or real threads.
 */
export default function TestDraftsPage() {
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <div className="p-8">Loading test page...</div>;
  }
  
  return <TestDraftsContent />;
}

function TestDraftsContent() {
  const [threadId, setThreadId] = useState("test-thread-1");
  const [responseText, setResponseText] = useState("");
  const { loadDraft, saveDraft, discardDraft, hasDraft, getLastSaved } = useDraftStorage();

  // Load draft when threadId changes
  React.useEffect(() => {
    const draft = loadDraft(threadId);
    if (draft) {
      setResponseText(draft);
    } else {
      setResponseText("");
    }
  }, [threadId, loadDraft]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setResponseText(newValue);
    saveDraft(threadId, newValue);
  };

  const handleReset = () => {
    setResponseText("");
    discardDraft(threadId);
  };

  const handleSubmit = () => {
    alert(`Submitted response for ${threadId}: "${responseText}"`);
    // Simulate successful submission
    discardDraft(threadId);
    setResponseText("");
  };

  const switchThread = (newThreadId: string) => {
    setThreadId(newThreadId);
  };

  const lastSaved = getLastSaved(threadId);
  const showDraftIndicator = hasDraft(threadId) && lastSaved;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Draft Auto-Save Test Page
        </h1>
        <p className="text-gray-600 mb-8">
          Test the draft auto-save functionality without needing LangSmith configuration
        </p>

        {/* Test Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            🧪 Testing Instructions
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>
              <strong>Test 1:</strong> Type in the textarea below, wait 5 seconds, see "Draft saved" indicator
            </li>
            <li>
              <strong>Test 2:</strong> Refresh page (F5), verify draft restores
            </li>
            <li>
              <strong>Test 3:</strong> Switch between threads, verify each maintains its own draft
            </li>
            <li>
              <strong>Test 4:</strong> Click Reset, verify draft is discarded
            </li>
            <li>
              <strong>Test 5:</strong> Type draft, submit, verify draft is cleaned up
            </li>
            <li>
              <strong>Test 6:</strong> Open browser console (F12) to see debug logs
            </li>
          </ol>
        </div>

        {/* Thread Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Current Thread: <span className="text-blue-600">{threadId}</span>
          </h3>
          <div className="flex gap-2">
            <Button
              variant={threadId === "test-thread-1" ? "default" : "outline"}
              onClick={() => switchThread("test-thread-1")}
            >
              Thread 1
            </Button>
            <Button
              variant={threadId === "test-thread-2" ? "default" : "outline"}
              onClick={() => switchThread("test-thread-2")}
            >
              Thread 2
            </Button>
            <Button
              variant={threadId === "test-thread-3" ? "default" : "outline"}
              onClick={() => switchThread("test-thread-3")}
            >
              Thread 3
            </Button>
          </div>
        </div>

        {/* Response Input (mimics inbox-item-input.tsx ResponseComponent) */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Respond to Assistant
            </h3>
            <Button
              onClick={handleReset}
              variant="ghost"
              className="flex items-center gap-2 text-gray-500 hover:text-red-500"
            >
              <Undo2 className="w-4 h-4" />
              <span>Reset</span>
            </Button>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Response
              </label>
              {showDraftIndicator && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ Draft saved at {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            <Textarea
              value={responseText}
              onChange={handleChange}
              rows={6}
              placeholder="Type your response here... (saves automatically after 5 seconds)"
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {responseText.length} characters
            </div>
            <Button
              onClick={handleSubmit}
              variant="default"
              disabled={!responseText.trim()}
            >
              Send Response
            </Button>
          </div>
        </div>

        {/* Draft Status Panel */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Draft Status
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Thread 1:</span>
              <span className={`ml-2 font-medium ${hasDraft("test-thread-1") ? "text-green-600" : "text-gray-400"}`}>
                {hasDraft("test-thread-1") ? "✓ Has Draft" : "○ No Draft"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Thread 2:</span>
              <span className={`ml-2 font-medium ${hasDraft("test-thread-2") ? "text-green-600" : "text-gray-400"}`}>
                {hasDraft("test-thread-2") ? "✓ Has Draft" : "○ No Draft"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Thread 3:</span>
              <span className={`ml-2 font-medium ${hasDraft("test-thread-3") ? "text-green-600" : "text-gray-400"}`}>
                {hasDraft("test-thread-3") ? "✓ Has Draft" : "○ No Draft"}
              </span>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">
            💡 Testing Tips
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-yellow-800">
            <li>Open browser console (F12) to see draft save/load debug messages</li>
            <li>The 5-second timer resets each time you type (debounced)</li>
            <li>Try typing quickly, then wait - should only save once after 5 seconds</li>
            <li>Page refresh should restore all drafts in all threads</li>
            <li>Each thread maintains its own independent draft</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
