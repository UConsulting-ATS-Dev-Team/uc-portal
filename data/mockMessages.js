// Mock conversations (wireframe 3f). personId ties back to data/mockPeople.js
// so the thread header/context line can reuse real person data rather than
// duplicating name/role/company here.
export const CONVERSATIONS = [
  {
    id: "conv-1",
    personId: "marcus-webb",
    isRequest: false,
    unread: false,
    originLabel: "Coffee chat request accepted · Aug 17",
    scheduledChat: "coffee chat Wed 4:00pm",
    messages: [
      { id: "m1", author: "them", body: "Hey! Happy to chat Wednesday. Anything specific you want to cover?", timestamp: "Aug 17, 2:14pm" },
      { id: "m2", author: "me", body: "Mostly curious how the case rounds went for you last cycle, and any prep tips.", timestamp: "Aug 17, 3:02pm" },
      { id: "m3", author: "them", body: "Happy to walk through it. I'll also send over the drill sheet I mentioned on the feed.", timestamp: "Aug 17, 3:10pm", sharedResource: { title: "Mental Math Drill Sheet", logo: "PDF" } },
      { id: "m4", author: "me", body: "Thanks again for the referral — really appreciate it.", timestamp: "Aug 18, 9:41am" },
    ],
  },
  {
    id: "conv-2",
    personId: "priya-nair",
    isRequest: true,
    unread: true,
    originLabel: "Coffee chat request sent · Aug 15",
    scheduledChat: null,
    messages: [
      { id: "m1", author: "me", body: "Hi Priya! Would love to hear about your experience at McKinsey if you have 20 minutes sometime this month.", timestamp: "Aug 15, 11:20am" },
    ],
  },
  {
    id: "conv-3",
    personId: "sana-liu",
    isRequest: false,
    unread: false,
    originLabel: "Coffee chat request accepted · Aug 5",
    scheduledChat: null,
    messages: [
      { id: "m1", author: "them", body: "Great chatting today — let me know if the case guide sections were helpful once you get through them.", timestamp: "Aug 5, 5:30pm" },
      { id: "m2", author: "me", body: "Will do, thank you again!", timestamp: "Aug 5, 5:45pm" },
    ],
  },
  {
    id: "conv-4",
    personId: "deepak-shah",
    isRequest: false,
    unread: false,
    originLabel: "Started from Deepak's referral post · Aug 12",
    scheduledChat: null,
    messages: [
      { id: "m1", author: "them", body: "Saw you applied to the Goldman IBD role — happy to put in a good word if you want.", timestamp: "Aug 12, 1:00pm" },
      { id: "m2", author: "me", body: "That would mean a lot, thank you!", timestamp: "Aug 12, 1:15pm" },
    ],
  },
  {
    id: "conv-5",
    personId: "grace-kim",
    isRequest: false,
    unread: false,
    originLabel: "Started from Grace's Deloitte write-up · Aug 9",
    scheduledChat: null,
    messages: [
      { id: "m1", author: "me", body: "Your write-up on the Deloitte behavioral round was super helpful, thank you for posting it.", timestamp: "Aug 9, 4:00pm" },
      { id: "m2", author: "them", body: "Of course! Good luck with your round.", timestamp: "Aug 9, 4:20pm" },
    ],
  },
  {
    id: "conv-6",
    personId: "maya-chen",
    isRequest: true,
    unread: false,
    originLabel: "Coffee chat request sent · Aug 3",
    scheduledChat: null,
    messages: [
      { id: "m1", author: "me", body: "Hi Maya, would love to connect about BCG's LA office sometime.", timestamp: "Aug 3, 10:00am" },
    ],
  },
];

// Every "Message" link (Network.jsx, MemberProfile.jsx) used to just go
// to bare /messages with no indication of who you meant to message --
// it landed on whatever conversation happened to be first, not theirs.
// This is the single source of truth both those pages and Messages.jsx
// itself use to find/jump to the right thread; a person with no seeded
// conversation here correctly has no match, which those pages use to
// show an honestly-disabled "Message" instead of a button that looks
// live but goes nowhere useful.
export function findConversationByPersonId(personId) {
  return CONVERSATIONS.find((c) => c.personId === personId) ?? null;
}
