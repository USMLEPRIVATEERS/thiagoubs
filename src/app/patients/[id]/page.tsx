import PatientDetailPage from './PatientClient'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function Page() {
  return <PatientDetailPage />
}
