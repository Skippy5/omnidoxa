# OmniDoxa Context

OmniDoxa is a topic-first news intelligence context for tracking how public discourse forms around news stories across political perspectives.

## Language

**Topic**:
A persistent editorial record for one specific newsworthy story, event, development, or public controversy. A Topic is the public-facing unit of OmniDoxa.
_Avoid_: Story bucket, article, feed item

**Central Development**:
The specific thing that happened or changed within a Topic. Sentiment Scores and Social Post relevance are judged against the Central Development.
_Avoid_: Central topic, vague subject

**Article**:
A source document used to create, verify, or contextualize a Topic. Articles are inputs, not the main public unit of analysis.
_Avoid_: Topic, source comparison item

**Anchor Article**:
The primary Article submitted by an Admin to create a Topic.
_Avoid_: Supporting article, article bundle

**Duplicate Candidate**:
A submitted Article that appears to cover the same specific story as an existing Topic. Duplicate Candidates require Admin review rather than automatic merging.
_Avoid_: Auto-merged topic, article cluster

**Material Update**:
A new development or source input that meaningfully changes an existing Topic's factual basis or public discourse.
_Avoid_: Silent replacement, minor edit

**Viewpoint**:
OmniDoxa's interpretation of how one political perspective is discussing a Topic. Viewpoints use the canonical Political Leans: Left, Center, and Right.
_Avoid_: Sentiment, take, opinion bucket

**Political Lean**:
The canonical position assigned to a Viewpoint: Left, Center, or Right.
_Avoid_: Progressive, institutional, conservative spectrum label

**Neutral Topic Summary**:
A neutral explanation of what happened in a Topic.
_Avoid_: Discourse Summary, editorial take

**Discourse Summary**:
A neutral synthesis of how public reaction is distributed across the Left, Center, and Right Viewpoints.
_Avoid_: Average sentiment, verdict

**Discourse Preview**:
A free-facing summary that hints at a Topic's debate without revealing full Premium Analysis.
_Avoid_: Viewpoint summary, full analysis

**Sentiment Score**:
A measure of how supportive or critical a Viewpoint is toward the Topic's Central Development.
_Avoid_: Party approval, source bias score

**Candidate Social Post**:
A social post returned by an analysis provider for possible use as evidence. It must be reviewed before counting toward publishability.
_Avoid_: Verified Social Post

**Social Post**:
A real public social media post used as evidence for a Viewpoint. It must have a verifiable source URL, visible text, platform, author information, and direct relevance to the Topic.
_Avoid_: Generated post, unverifiable post

**Evidence Threshold**:
The minimum verified Social Post evidence required before a Topic can be published. OmniDoxa defines this threshold, not the AI provider.
_Avoid_: Grok decision, model confidence

**Publishable Topic**:
A Topic with enough verified analysis and evidence to appear publicly. A Topic needs at least two verified Social Posts for each Left, Center, and Right Viewpoint.
_Avoid_: Good enough topic

**Editorial Review**:
The human Admin review step before publication.
_Avoid_: Automatic publish decision

**Editorial Summary**:
An AI-generated summary that an Admin may edit during Editorial Review. Social Post text is not an Editorial Summary.
_Avoid_: Evidence text

**Analysis Version**:
A complete snapshot of OmniDoxa's understanding of a Topic's discourse at a point in time.
_Avoid_: Draft save, edit revision

**Admin**:
An invited editorial operator who can manage Topics and analysis. Admin status is separate from Subscriber status.
_Avoid_: Public user, self-serve admin

**Member**:
A logged-in OmniDoxa account without editorial management permissions.
_Avoid_: Admin, subscriber by default

**Subscriber**:
A Member with active paid access to premium features.
_Avoid_: Admin, paying admin

**Premium Analysis**:
The paid analysis layer for a Topic, including full Viewpoints and verified Social Posts. Free users may see locked panels, but not readable details.
_Avoid_: Free preview

**Daily Briefing**:
A personalized digest for registered OmniDoxa accounts. Anonymous visitors do not receive Daily Briefings.
_Avoid_: Public newsletter, generic article digest

**Basic Briefing**:
The limited Daily Briefing available to registered Members.
_Avoid_: Premium Briefing

**Premium Briefing**:
The Subscriber Daily Briefing with expanded modules, AI analysis, saved preferences, and later custom Briefing Requests.
_Avoid_: Basic Briefing

**Briefing Module**:
A configurable section inside a Daily Briefing, such as weather, markets, stocks, category news, or a custom AI section.
_Avoid_: Topic, News Category

**Briefing Request**:
A Subscriber-authored instruction for a custom AI-generated briefing section. It should retrieve and cite public web information.
_Avoid_: Uncontrolled scrape instruction

**News Category**:
A shared top-level classification for Topics and Briefing news sections. Initial categories: Politics, U.S., World, Business, Tech & AI, Science & Health, Entertainment.
_Avoid_: Briefing-only category, niche interest

**Engagement Feature**:
An interactive feature that uses published Topics and Viewpoints without becoming part of the editorial record.
_Avoid_: Topic workflow

**Viewpoint Excerpt**:
A limited portion of a published Viewpoint used inside an Engagement Feature.
_Avoid_: Full Viewpoint, Premium Analysis
