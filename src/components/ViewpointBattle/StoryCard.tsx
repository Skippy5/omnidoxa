interface Story {
  headline: string;
  image: string;
}

interface StoryCardProps {
  story: Story;
  currentIndex: number;
  totalStories: number;
}

export default function StoryCard({ story, currentIndex, totalStories }: StoryCardProps) {
  return (
    <div className="mb-6">
      <div className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
        Story {currentIndex + 1} of {totalStories}
      </div>
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        {story.headline}
      </h2>
      {story.image && (
        <img
          src={story.image}
          alt={story.headline}
          className="w-full max-w-2xl mx-auto rounded-lg mb-6"
          style={{ maxHeight: '300px', objectFit: 'cover', border: '1px solid var(--border)' }}
        />
      )}
    </div>
  );
}
