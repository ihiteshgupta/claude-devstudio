import { useState } from 'react'
import type { TechChoice, TechOption } from '@shared/types'

interface TechChoiceModalProps {
  choice: TechChoice
  onDecide: (selectedOption: string, rationale: string) => void
  onCancel: () => void
}

const LEARNING_CURVE_COLORS = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400'
}

const COMMUNITY_ICONS = {
  small: '👥',
  medium: '👥👥',
  large: '👥👥👥'
}

export function TechChoiceModal({ choice, onDecide, onCancel }: TechChoiceModalProps): JSX.Element {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    choice.options.find(o => o.isRecommended)?.name || null
  )
  const [rationale, setRationale] = useState('')

  const handleSubmit = (): void => {
    if (selectedOption) {
      onDecide(selectedOption, rationale)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
              <i className="fas fa-lightbulb" />
              Technology Decision Required
            </div>
            <h2 className="text-lg font-semibold text-white">{choice.question}</h2>
            {choice.context && (
              <p className="text-sm text-zinc-400 mt-1">{choice.context}</p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <i className="fas fa-times text-zinc-400" />
          </button>
        </div>

        {/* Options Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {choice.options.map((option) => (
              <TechOptionCard
                key={option.name}
                option={option}
                isSelected={selectedOption === option.name}
                onSelect={() => setSelectedOption(option.name)}
              />
            ))}
          </div>

          {/* Comparison Table */}
          {choice.options.length > 1 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-400 mb-3">Quick Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 px-3 text-zinc-500">Aspect</th>
                      {choice.options.map(opt => (
                        <th key={opt.name} className="text-left py-2 px-3 text-white">
                          {opt.name}
                          {opt.isRecommended && (
                            <span className="ml-2 text-xs bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 px-3 text-zinc-400">Learning Curve</td>
                      {choice.options.map(opt => (
                        <td key={opt.name} className={`py-2 px-3 capitalize ${LEARNING_CURVE_COLORS[opt.learningCurve]}`}>
                          {opt.learningCurve}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 px-3 text-zinc-400">Community</td>
                      {choice.options.map(opt => (
                        <td key={opt.name} className="py-2 px-3">
                          <span className="capitalize">{opt.communitySupport}</span>
                          <span className="ml-2">{COMMUNITY_ICONS[opt.communitySupport]}</span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 px-3 text-zinc-400">Setup Time</td>
                      {choice.options.map(opt => (
                        <td key={opt.name} className="py-2 px-3 text-zinc-300">
                          {opt.estimatedSetupTime || 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-zinc-400">Pros</td>
                      {choice.options.map(opt => (
                        <td key={opt.name} className="py-2 px-3 text-green-400">
                          {opt.pros.length} advantages
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-zinc-400">Cons</td>
                      {choice.options.map(opt => (
                        <td key={opt.name} className="py-2 px-3 text-red-400">
                          {opt.cons.length} considerations
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Decision Rationale */}
          <div className="mt-6">
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">
              Decision Rationale (Optional)
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why did you choose this option? This will be saved for future reference..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Select a technology option to continue with task execution
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel Task
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="fas fa-check" />
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TechOptionCardProps {
  option: TechOption
  isSelected: boolean
  onSelect: () => void
}

function TechOptionCard({ option, isSelected, onSelect }: TechOptionCardProps): JSX.Element {
  return (
    <div
      onClick={onSelect}
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            isSelected ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
          }`}>
            {isSelected && <i className="fas fa-check text-[8px] text-white" />}
          </div>
          <h3 className="font-semibold text-white">{option.name}</h3>
        </div>
        {option.isRecommended && (
          <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
            <i className="fas fa-star text-[10px]" />
            Recommended
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-400 mb-4">{option.description}</p>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
        <span className={`${LEARNING_CURVE_COLORS[option.learningCurve]}`}>
          <i className="fas fa-graduation-cap mr-1" />
          {option.learningCurve} learning curve
        </span>
        <span>
          {COMMUNITY_ICONS[option.communitySupport]} {option.communitySupport} community
        </span>
      </div>

      {/* Pros */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
          <i className="fas fa-plus-circle" />
          Advantages
        </h4>
        <ul className="space-y-1">
          {option.pros.slice(0, 4).map((pro, i) => (
            <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
              <i className="fas fa-check text-green-500 mt-0.5 text-[10px]" />
              <span>{pro}</span>
            </li>
          ))}
          {option.pros.length > 4 && (
            <li className="text-xs text-zinc-500">+{option.pros.length - 4} more</li>
          )}
        </ul>
      </div>

      {/* Cons */}
      <div>
        <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
          <i className="fas fa-minus-circle" />
          Considerations
        </h4>
        <ul className="space-y-1">
          {option.cons.slice(0, 3).map((con, i) => (
            <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
              <i className="fas fa-exclamation-triangle text-red-500 mt-0.5 text-[10px]" />
              <span>{con}</span>
            </li>
          ))}
          {option.cons.length > 3 && (
            <li className="text-xs text-zinc-500">+{option.cons.length - 3} more</li>
          )}
        </ul>
      </div>

      {/* Setup Time */}
      {option.estimatedSetupTime && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">
            <i className="fas fa-clock mr-1" />
            Setup: {option.estimatedSetupTime}
          </span>
        </div>
      )}
    </div>
  )
}
