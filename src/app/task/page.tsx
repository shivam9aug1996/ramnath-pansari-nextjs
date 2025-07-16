"use client"
import React from 'react'
import TabsForm from './components/TabsForm'
import tabConfig from './tabConfig'

const page = () => {
  return (
    <div style={{ padding: 24 }}>
      <TabsForm config={tabConfig} />
    </div>
  )
}

export default page