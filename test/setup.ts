// The shop runs on India time. Tests run in a different zone so any hidden dependence on the machine's zone fails.
process.env.TZ = "America/Los_Angeles"
