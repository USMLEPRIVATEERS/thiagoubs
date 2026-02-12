import IndicatorDetailPage from './IndicatorClient'

export function generateStaticParams() {
  return [
    { indicator: 'c1' },
    { indicator: 'c2' },
    { indicator: 'c3' },
    { indicator: 'c4' },
    { indicator: 'c5' },
    { indicator: 'c6' },
    { indicator: 'c7' },
  ]
}

export default function Page() {
  return <IndicatorDetailPage />
}
