// Copyright 2017 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License")
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var functions = require('firebase-functions')
// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin')
// Library used to get data from AQ3D API
const axios = require('axios')

// Initializes app so we can interact with the database
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://aq3d-server-status.firebaseio.com/'
})

// Reference to the servers object
var servers = admin.database().ref('servers')

// Function that runs every 10 minutes
exports.serverStatusSnap =
  // Listens to pubsub event with topic 'ten-minute-click'
  functions.pubsub.topic('ten-minute-tick').onPublish((event) => {
    // Grab API output
    axios.get('https://game.aq3d.com/api/Game/ServerList').then(res => {
      // Handle each record in the array that comes back
      res.data.forEach(record => {
        // Push a snapshot to the Server/snaps object
        servers.child(`${record.Name.replace(/ /g, '').toLowerCase()}/snaps`).push(
          { UserCount: record.UserCount || 0, State: record.State || false, timestamp: Date.now() },
          err => {
            if (err)
              console.log(err)
            else
              console.log(`${record.Name} Snaps Updated`)
          }
        )

        // Update the server info itself, in case something changed
        servers.child(`${record.Name.replace(/ /g, '').toLowerCase()}`).update(
          {
            ID: record.ID || null,
            SortIndex: record.SortIndex || null,
            Name: record.Name || null,
            IP: record.IP || null,
            Port: record.Port || null,
            MaxUsers: record.MaxUsers || null,
            Language: record.Language || null,
            LocalIP: record.LocalIP || null,
            LastUpdated: record.LastUpdated || null,
            BuildVersion: record.BuildVersion || null,
            HostName: record.HostName || null,
            timestamp: Date.now()
          },
          err => {
            if (err)
              console.log(err)
            else
              console.log(`${record.Name} Updated`)
          }
        )

        // Delete snaps that are a year old (THIS SHOULD ARCHIVE THEM SOMEWHERE ELSE INSTEAD)
        var snaps = servers.child(`${record.Name.replace(/ /g, '').toLowerCase()}/snaps/`)
          .orderByChild('timestamp')
          .endAt(Date.now() - 365 * 60 * 60 * 1000)
        // Once the results are returned, handle the deletion of old snaps
        snaps.once('value', snapshot => {
          var updates = {}
          snapshot.forEach( child => { updates[child.key] = null })
          // execute all updates in one go and return the result to end the function
          servers.child(`${record.Name.replace(/ /g, '').toLowerCase()}/snaps/`).update(updates, err => {
            if (err)
              console.log(err)
            else
              console.log(`${record.Name}'s Old Snaps Cleaned Out`)
          })
        })
      })
    })
  })