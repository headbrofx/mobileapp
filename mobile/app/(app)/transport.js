import { Redirect } from 'expo-router';

// Transport is requested through the same "Omba" procedure as a home
// visit: it is one of the services listed there. This route stays so
// that older links and notifications still land somewhere sensible.
export default function TransportRoute() {
  return <Redirect href={{ pathname: '/book', params: { service: 'transport' } }} />;
}
