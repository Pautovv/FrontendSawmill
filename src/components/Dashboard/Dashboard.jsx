import React from 'react'
import StatsGrid from './StatsGrid'
import ChartSection from './ChartSection'

function Dashboard() {
  return (
    <div className='space-y-6'>
        <StatsGrid />

        <ChartSection />
    </div>
  )
}

export default Dashboard