import { useState } from 'react'
import type { ApprovalGate, QueuedTask, GateType } from '@shared/types'

interface ApprovalDialogProps {
  gate: ApprovalGate
  task?: QueuedTask
  onApprove: (notes?: string) => void
  onReject: (reason: string) => void
  onClose: () => void
}

const GATE_TYPE_INFO: Record<GateType, { icon: string; color: string; label: string }> = {
  manual: { icon: 'hand-paper', color: 'text-orange-400', label: 'Manual Approval' },
  quality: { icon: 'check-circle', color: 'text-green-400', label: 'Quality Review' },
  security: { icon: 'shield-alt', color: 'text-red-400', label: 'Security Check' },
  tech_decision: { icon: 'lightbulb', color: 'text-amber-400', label: 'Technology Decision' },
  review: { icon: 'search', color: 'text-cyan-400', label: 'Output Review' }
}

export function ApprovalDialog({ gate, task, onApprove, onReject, onClose }: ApprovalDialogProps): JSX.Element {
  const [notes, setNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [expandedReview, setExpandedReview] = useState(false)

  const gateInfo = GATE_TYPE_INFO[gate.gateType]

  const handleApprove = (): void => {
    onApprove(notes || undefined)
  }

  const handleReject = (): void => {
    if (rejectReason.trim()) {
      onReject(rejectReason)
    }
  }

  // Try to parse review data as JSON for better display
  let reviewDataFormatted = gate.reviewData
  let isJson = false
  if (gate.reviewData) {
    try {
      const parsed = JSON.parse(gate.reviewData)
      reviewDataFormatted = JSON.stringify(parsed, null, 2)
      isJson = true
    } catch {
      // Keep original
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${gateInfo.color}`}>
                <i className={`fas fa-${gateInfo.icon}`} />
              </div>
              <div>
                <p className={`text-xs font-medium ${gateInfo.color}`}>{gateInfo.label}</p>
                <h2 className="text-lg font-semibold text-white">{gate.title}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <i className="fas fa-times text-zinc-400" />
            </button>
          </div>
          {gate.description && (
            <p className="text-sm text-zinc-400 mt-3">{gate.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Task Info */}
          {task && (
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Task Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Title</span>
                  <span className="text-white font-medium">{task.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Type</span>
                  <span className="text-white capitalize">{task.taskType.replace('-', ' ')}</span>
                </div>
                {task.agentType && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Agent</span>
                    <span className="text-white capitalize">{task.agentType}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Autonomy</span>
                  <span className="text-white capitalize">{task.autonomyLevel.replace('_', ' ')}</span>
                </div>
                {task.description && (
                  <div className="pt-2 border-t border-zinc-700">
                    <p className="text-zinc-400 text-xs mb-1">Description</p>
                    <p className="text-zinc-300">{task.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Review Data */}
          {gate.reviewData && (
            <div className="bg-zinc-800/50 rounded-lg">
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/70 transition-colors rounded-t-lg"
                onClick={() => setExpandedReview(!expandedReview)}
              >
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <i className="fas fa-file-code" />
                  Review Data
                  {isJson && <span className="text-xs text-zinc-600 font-normal">(JSON)</span>}
                </h3>
                <i className={`fas fa-chevron-${expandedReview ? 'up' : 'down'} text-zinc-500`} />
              </div>
              <div className={`overflow-hidden transition-all ${expandedReview ? 'max-h-[400px]' : 'max-h-32'}`}>
                <pre className="p-3 pt-0 text-xs text-zinc-300 overflow-auto font-mono whitespace-pre-wrap">
                  {reviewDataFormatted}
                </pre>
              </div>
              {!expandedReview && gate.reviewData.length > 300 && (
                <div className="px-3 pb-2">
                  <button
                    onClick={() => setExpandedReview(true)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Show more...
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Approval Notes */}
          {!showRejectForm && (
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">
                Approval Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle" />
                Rejection Reason
              </h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={3}
                autoFocus
                className="w-full bg-zinc-900 border border-red-800/50 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}

          {/* Gate Checklist for certain types */}
          {(gate.gateType === 'quality' || gate.gateType === 'review') && (
            <div className="bg-zinc-800/30 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Review Checklist
              </h3>
              <div className="space-y-2">
                {[
                  'Output matches expected requirements',
                  'No errors or warnings in execution',
                  'Code quality meets standards',
                  'Ready for next step in pipeline'
                ].map((item, i) => (
                  <label key={i} className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="group-hover:text-white transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showRejectForm && (
          <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              <i className="fas fa-clock mr-1" />
              Created {new Date(gate.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRejectForm(true)}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <i className="fas fa-times mr-2" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <i className="fas fa-check" />
                Approve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
