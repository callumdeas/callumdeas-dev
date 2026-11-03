import { Boot } from './_planet/Boot'
import { StaticSite } from './_planet/StaticSite'
import WorldLoader from './_planet/WorldLoader'

export default function Home() {
  return (
    <>
      <StaticSite />
      <Boot />
      <WorldLoader />
    </>
  )
}
