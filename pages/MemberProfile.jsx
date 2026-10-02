import { useParams } from "react-router-dom";
import Placeholder from "./Placeholder.jsx";
import RealMemberProfile from "./RealMemberProfile.jsx";

// Every profile is a real UConsulting Directory person (UUID id) now that
// the fictional demo roster is gone -- anything else is a stale or hand-typed
// link, so it gets an honest "not found" rather than a blank page.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MemberProfile() {
  const { personId } = useParams();
  return UUID_PATTERN.test(personId) ? <RealMemberProfile personId={personId} /> : <Placeholder title="Member not found" />;
}
