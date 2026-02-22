'use client';

import { useState, useEffect } from 'react';
import ScoreBanner from './ScoreBanner';
import StoryCard from './StoryCard';
import SummaryChoice from './SummaryChoice';
import FeedbackView from './FeedbackView';
import ProgressBar from './ProgressBar';
import FinalScore from './FinalScore';

interface Summary {
  id: string;
  text: string;
  url?: string;
  actualLean: string;
}

interface Story {
  id: string;
  headline: string;
  image: string;
  summaries: Summary[];
}

interface FeedbackResult {
  id: string;
  guess: string;
  actual: string;
  correct: boolean;
  tip?: string;
}

interface FeedbackResponse {
  correct: number;
  total: number;
  points: number;
  results: FeedbackResult[];
}

export default function GameView() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/game/story?count=10');

      if (!res.ok) {
        throw new Error('Failed to fetch stories');
      }

      const data = await res.json();

      if (!data.stories || data.stories.length === 0) {
        throw new Error('No stories available. Please try again later.');
      }

      setStories(data.stories);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game');
      setLoading(false);
    }
  };

  const handleGuess = (summaryId: string, lean: string) => {
    setGuesses({ ...guesses, [summaryId]: lean });
  };

  const handleSubmit = async () => {
    const currentStory = stories[currentIndex];

    try {
      const res = await fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: currentStory.id,
          guesses,
          summaries: currentStory.summaries,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit answers');
      }

      const result: FeedbackResponse = await res.json();

      setTotalCorrect(totalCorrect + result.correct);
      setTotalAnswers(totalAnswers + result.total);
      setScore(score + result.points);
      setFeedback(result);
      setShowFeedback(true);

      if (result.correct === result.total) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) {
          setBestStreak(newStreak);
        }
      } else {
        setStreak(0);
      }
    } catch (err) {
      console.error('Error submitting answers:', err);
      setError('Failed to submit answers. Please try again.');
    }
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setGuesses({});
      setShowFeedback(false);
      setFeedback(null);
    } else {
      setGameComplete(true);
    }
  };

  const handlePlayAgain = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTotalCorrect(0);
    setTotalAnswers(0);
    setGuesses({});
    setShowFeedback(false);
    setFeedback(null);
    setGameComplete(false);
    fetchStories();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-t-purple-400" style={{ borderColor: 'var(--border)', borderTopColor: '#a855f7' }} />
        <div className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Loading game...
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          Fetching stories from the news universe
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="text-xl font-bold mb-2" style={{ color: '#f87171' }}>
          Oops!
        </div>
        <div className="mb-4" style={{ color: 'var(--text-secondary)' }}>
          {error}
        </div>
        <button
          onClick={fetchStories}
          className="px-6 py-3 font-bold rounded-lg transition-all hover:opacity-90 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--vp-left-border), #7c3aed)',
            color: 'white',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (gameComplete) {
    return (
      <FinalScore
        score={score}
        totalCorrect={totalCorrect}
        totalAnswers={totalAnswers}
        bestStreak={bestStreak}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  if (showFeedback && feedback) {
    const summaryLabels: Record<string, string> = {};
    const summaryUrls: Record<string, string> = {};
    stories[currentIndex].summaries.forEach((s, idx) => {
      summaryLabels[s.id] = `Tweet ${String.fromCharCode(65 + idx)}`;
      if (s.url) summaryUrls[s.id] = s.url;
    });

    return (
      <FeedbackView
        feedback={feedback}
        onNext={handleNext}
        currentIndex={currentIndex}
        totalStories={stories.length}
        summaryLabels={summaryLabels}
        summaryUrls={summaryUrls}
      />
    );
  }

  const currentStory = stories[currentIndex];
  const allGuessesSelected = currentStory.summaries.every(s => guesses[s.id]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ScoreBanner score={score} streak={streak} />

      <StoryCard
        story={currentStory}
        currentIndex={currentIndex}
        totalStories={stories.length}
      />

      <div className="mb-6">
        <div className="text-lg font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Which political lean does each tweet represent?
        </div>
        {currentStory.summaries.map((summary, idx) => (
          <SummaryChoice
            key={summary.id}
            summary={summary}
            label={`Tweet ${String.fromCharCode(65 + idx)}`}
            onGuess={handleGuess}
            selectedLean={guesses[summary.id]}
          />
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allGuessesSelected}
        className="w-full py-4 font-bold text-lg rounded-xl transition-all"
        style={{
          background: allGuessesSelected
            ? 'linear-gradient(135deg, var(--vp-left-border), #7c3aed)'
            : 'var(--border)',
          color: allGuessesSelected ? 'white' : 'var(--text-dim)',
          cursor: allGuessesSelected ? 'pointer' : 'not-allowed',
        }}
      >
        {allGuessesSelected ? 'SUBMIT ANSWERS' : 'SELECT ALL ANSWERS TO CONTINUE'}
      </button>

      <ProgressBar current={currentIndex + 1} total={stories.length} />
    </div>
  );
}
