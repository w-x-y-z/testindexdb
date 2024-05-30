//https://es.javascript.info/indexeddb
const DBVersionManager = {
  name: 'DBManager',
  versionManager: 1,
  dbManager: null,
  request: null,
  table: 'versionesBD',
  indices: [
    { name: 'name', keyPath: 'name', unique: true },
    { name: 'version', keyPath: 'version', unique: false }
  ],
  
  message: {
    status: null,
    message: null,
    data: null
  },

  init() {
    return new Promise((resolve, reject) => {
      this.request = window.indexedDB.open(this.name, this.versionManager);

      this.request.onupgradeneeded = (event) => {
        this.dbManager = event.target.result;
        if (!this.dbManager.objectStoreNames.contains(this.table)) {
          let objectStore = this.dbManager.createObjectStore(this.table, { keyPath: 'id', autoIncrement: true });
          this.indices.forEach(index => {
            objectStore.createIndex(index.name, index.keyPath, { unique: index.unique });
          });
        }
        this.log(`Init create BD ${this.name}(${this.versionManager})`,1)
      };

      this.request.onsuccess = (event) => {
        this.dbManager = event.target.result;
        this.log(`Open BD ${this.dbManager.name}:${this.dbManager.version}`,1);

        if (this.dbManager instanceof IDBDatabase) {
          this.log(`Status: ${this.dbManager.name} ok`,1);
        } else {
          this.log(`Error connected ${this.dbManager.name}`,0);
        }

        this.dbManager.addEventListener('versionchange', () => {
          this.log(`Other version ${this.dbManager.name} ok`,2);
          this.dbManager.close();
        });

        resolve();
      };

      this.request.onerror = (event) => {
        this.log(`Error open ${this.dbManager.name} ${event.target.error} ok`,0);
        reject(event.target.error);
      };

      this.request.onblocked = (event) => {
        this.log(`Blocked BD ${this.dbManager.name} ${event} ok`,2)
      };
    });
  },

  addDB(record) {
    return new Promise((resolve, reject) => {
      if (this.dbManager) {
        let transaction = this.dbManager.transaction([this.table], 'readwrite');
        let objectStore = transaction.objectStore(this.table);
        let request = objectStore.add(record);

        request.onsuccess = () => {
          //console.log(`%cObjeto agregado con éxito: ${JSON.stringify(record)}`, 'color:green;');
          this.message = {
            status: 'success',
            message: `Objeto agregado con éxito`,
            data: record
          };
          resolve(this.message);
        };

        request.onerror = (event) => {
          //console.log(`%cError al agregar el objeto ${event.target.error}`,'color:red');
          this.message = {
            status: 'error',
            message: 'Error al agregar el objeto',
            data: event.target.error
          };
          reject(this.message);
        };

        transaction.oncomplete = (event) => {
          this.log(`Add BD complete ${record.name}(${record.version})`,1)
        };

        transaction.onerror = (event) => {
          this.log(`Error add BD ${record} ${event.target.error}`,0);
          transaction.abort();
        };
        transaction.onabort = (event)=> {
          this.log(`Cancel add BD: ${event.target.error}`,2);
        }
      } else {
        console.log('La base de datos no está abierta.');
        this.log(`Not open BD: ${this.name}`,0);
        this.message = {
          status: 'error',
          message: 'La base de datos no está abierta',
          data: null
        };
        reject(this.message);
      }
    });
  },

  async addDBWithInit(record) {
    try {
      await this.init();
      let result = await this.addDB(record);
      return result;
    } catch (error) {
      //console.log(`%cError inicializando la base de datos:${error}`,'color:red');
      this.message = {
        status: 'error',
        message: 'Error inicializando la base de datos',
        data: error
      };
      return this.message;
    }
  },

  async getByName(name) {
    if (!this.dbManager) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      let transaction = this.dbManager.transaction([this.table], 'readonly');
      let objectStore = transaction.objectStore(this.table);
      let index = objectStore.index('name');
      let request = index.get(name);

      request.onsuccess = (event) => {
        if (event.target.result) {
          //console.log(`%cRegistro encontrado: ${JSON.stringify(event.target.result)}`, 'color:green;');
          this.message = {
            status: 'success',
            message: `Registro encontrado.`,
            data: event.target.result
          };
          resolve(this.message);
        } else {
          this.log(`Not found BD ${name}`,0)
          this.message = {
            status: 'error',
            message: 'No se encontró ningún registro',
            data: null
          };
          resolve(this.message);
        }
      };

      request.onerror = (event) => {
        this.log(`Error get BD ${name}`,0)
        this.message = {
          status: 'error',
          message: 'Error al buscar el objeto',
          data: event.target.error
        };
        reject(this.message);
      };
    });
  },

  async updateVersionByName(name, newVersion) {
    if (!this.dbManager) {
      await this.init();
    }

    try {
      let recordMessage = await this.getByName(name);
      if (recordMessage.status === 'success' && recordMessage.data) {
        let record = recordMessage.data;
        record.version = newVersion;
        let transaction = this.dbManager.transaction([this.table], 'readwrite');
        let objectStore = transaction.objectStore(this.table);
        let request = objectStore.put(record);

        return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            //console.log(`%cRegistro actualizado con éxito: ${JSON.stringify(record)}`, 'color:green;');
            this.message = {
              status: 'success',
              message: `Registro actualizado con éxito: ${JSON.stringify(record)}`,
              data: record
            };
            resolve(this.message);
          };

          request.onerror = (event) => {
            //console.log(`Error al actualizar el objeto: ${event.target.error}`,'color:red');
            this.message = {
              status: 'error',
              message: 'Error al actualizar el objeto',
              data: event.target.error
            };
            reject(this.message);
          };
        });
      } else {
        //console.log('%cNo se encontró ningún registro para actualizar', 'color:red');
        this.message = {
          status: 'error',
          message: 'No se encontró ningún registro para actualizar',
          data: null
        };
        return this.message;
      }
    } catch (error) {
      //console.log(`%cError al actualizar el registro: ${error}`,'color:red');
      this.message = {
        status: 'error',
        message: 'Error al actualizar el registro',
        data: error
      };
      return this.message;
    }
  },

  async deleteByName(name) {
    if (!this.dbManager) {
      await this.init();
    }

    try {
      let recordMessage = await this.getByName(name);
      if (recordMessage.status === 'success' && recordMessage.data) {
        let record = recordMessage.data;
        let transaction = this.dbManager.transaction([this.table], 'readwrite');
        let objectStore = transaction.objectStore(this.table);
        let request = objectStore.delete(record.id);

        return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            //console.log(`%cRegistro eliminado con éxito: ${JSON.stringify(record)}`, 'color:green;');
            this.message = {
              status: 'success',
              message: `Registro eliminado con éxito: ${JSON.stringify(record)}`,
              data: record
            };
            resolve(this.message);
          };

          request.onerror = (event) => {
            //console.error('Error al eliminar el objeto:', event.target.error);
            this.message = {
              status: 'error',
              message: 'Error al eliminar el objeto',
              data: event.target.error
            };
            reject(this.message);
          };
        });
      } else {
        //console.log('%cNo se encontró ningún registro para eliminar', 'color:red');
        this.message = {
          status: 'error',
          message: 'No se encontró ningún registro para eliminar',
          data: null
        };
        return this.message;
      }
    } catch (error) {
      //console.error('Error al eliminar el registro:', error);
      this.message = {
        status: 'error',
        message: 'Error al eliminar el registro',
        data: error
      };
      return this.message;
    }
  },
  log(message, codeColor){
    let color='#c5d1d'
    switch (codeColor) {
      case 1:
        //ok
        color='#03c05c'
        break;
      case 2:
        //alert
        color='#e6ff09'
        break;
      case 0:
        //error
        color='#f95a3e'
        break;   
      default:
        break;
    }
    console.log(`%c♜ ${message} ♞`,`color:${color}`)
  },
  async getAllDb() {
    if (!this.dbManager) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      let transaction = this.dbManager.transaction([this.table], 'readonly');
      let objectStore = transaction.objectStore(this.table);
      let request = objectStore.getAll();

      request.onsuccess = (event) => {
        // Devolver todas las versiones
        this.message = {
          status: 'success',
          message: `Lista de BDs.`,
          data: event.target.result
        };
        resolve(this.message);
      };
      request.onerror = (event) => {
        // Manejar errores si los hay
        this.message = {
          status: 'error',
          message: 'Error listar las BDs',
          data: event.target.error
        };
        reject(this.message);
      };
    });
  }

};
const DBRLv2 = {
  indexDB: window.indexedDB,
  dbName: null,
  db: null,
  version: 0,
  request: null,
  vBD: DBVersionManager,
  objBDM: {},
  async ini(){
    await this.vBD.init();
    this.version=1;
  },
  openCreateDB(newDBName) {
    return new Promise(async (resolve, reject) => {
      await this.vBD.init();
      this.dbName=newDBName;
      const mjs = await this.vBD.getByName(this.dbName);
      if (mjs.status === "error") {
        this.version = 1;
        const bd = await this.vBD.addDBWithInit({
          name: this.dbName,
          version: this.version,
        });
        this.objBDM = bd.data;
      } else {
        this.version = mjs.data.version;
        this.dbName = mjs.data.name;
        this.objBDM = mjs.data;
      }

      this.request = this.indexDB.open(this.objBDM.name, this.objBDM.version);

      this.request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        console.log(`%cCreate BD: ${this.dbName}`, "color:green");
      };

      this.request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log(`%cOpen BD: ${this.db.name}(${this.db.version})`,"color:green");

        if (this.db instanceof IDBDatabase) {
          console.log(`%cStatus: ${this.db.name}(${this.db.version}) ok`, "color:green");
        } else {
          console.log(`%cStatus close BD: ${this.db.name}(${this.db.name.version})`, "color:red");
        }

        this.db.addEventListener("versionchange", () => {
          //console.log(this.objBDM)
          console.log(`%cUpdated version BD: ${this.db.name}(${this.objBDM.version})`,"color:yellow" );
          this.db.close();
        });
        resolve();
      };

      this.request.onerror = (event) => {
        console.log(`%cOpen error BD ${this.dbName} (${event.target.error})`,"color:red");
        reject(event.target.error);
      };

      this.request.onblocked = (event) => {
        console.log(`%cBlocked BD: ${this.dbName}`,"color:red");
      };
    });
  },
  alterDB() {
    return new Promise(async (resolve, reject) => {
      setTimeout(async () => {
      try {
        const mjs = await this.vBD.getByName(this.dbName);
        if (mjs.status === "success") {
          const mjsa = await this.vBD.updateVersionByName(this.dbName, this.version + 1);
          this.version = mjsa.data.version;
          this.dbName = mjsa.data.name;
          this.objBDM = mjsa.data;
          resolve(true);
        } else {
          console.log(`%cExist BD: ${mjs.data.name}(${mjs.data.version})`, "color:red");
          resolve(false);
        }
      } catch (error) {
        console.log(`%cError alter BD: ${error}`, "color:red");
        reject(error);
      }
        
    }, 100);
      
    });
  },
  createObjectStore(storeConfigs) {
    return new Promise(async (resolve, reject) => {
      try {
        const dbExists = await this.alterDB();
        if (!dbExists) {
          console.log(`%cNot exist BD: ${this.dbName}`, "color:red");
          return resolve();
        }

        this.request = this.indexDB.open(this.objBDM.name, this.objBDM.version);

        this.request.onupgradeneeded = (event) => {
          this.db = event.target.result;

          storeConfigs.forEach((storeConfig) => {
            if (!this.db.objectStoreNames.contains(storeConfig.name)) {
              const objectStore = this.db.createObjectStore(storeConfig.name, {
                keyPath: storeConfig.keyPath,
                autoIncrement: storeConfig.autoIncrement,
              });

              storeConfig.indices.forEach((index) => {
                objectStore.createIndex(index.name, index.keyPath, { unique: index.unique });
              });
              console.log(`%cObject store '${storeConfig.name}' created`, "color:green");
            } else {
              console.log(`%cObject store '${storeConfig.name}' already exists`, "color:yellow");
            }
          });
        };

        this.request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log(`%cObject stores checked/created successfully`, "color:green");
          resolve();
        };

        this.request.onerror = (event) => {
          console.log(`%cError creating object store: ${event.target.error}`, "color:red");
          reject(event.target.error);
        };

      } catch (error) {
        console.log(`%cError: ${error}`, "color:red");
        reject(error);
      }
    });
  },

  addRecord(storeName, record) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.add(record);
  
        request.onsuccess = (event) => {
          console.log(`%cRecord added successfully`, "color:green");
          resolve(event.target.result);
        };
  
        request.onerror = (event) => {
          console.log(`%cError adding record: ${event.target.error}`, "color:red");
          reject(event.target.error);
        };
      } catch (error) {
        console.log(`%cError: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  getRecord(storeName, key) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const transaction = this.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(key);
  
        request.onsuccess = (event) => {
          if (event.target.result) {
            console.log(`%cRecord retrieved successfully`, "color:green");
            resolve(event.target.result);
          } else {
            console.log(`%cNo record found with key: ${key}`, "color:red");
            resolve(null);
          }
        };
  
        request.onerror = (event) => {
          console.log(`%cError retrieving record: ${event.target.error}`, "color:red");
          reject(event.target.error);
        };
      } catch (error) {
        console.log(`%cError: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  updateRecord(storeName, record) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put(record);
  
        request.onsuccess = (event) => {
          console.log(`%cRecord updated successfully`, "color:green");
          resolve(event.target.result);
        };
  
        request.onerror = (event) => {
          console.log(`%cError updating record: ${event.target.error}`, "color:red");
          reject(event.target.error);
        };
      } catch (error) {
        console.log(`%cError: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  
  deleteRecord(storeName, key) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.delete(key);
  
        request.onsuccess = (event) => {
          console.log(`%cRecord deleted successfully with key: ${key}`, "color:green");
          resolve(true);
        };
  
        request.onerror = (event) => {
          console.log(`%cError deleting record: ${event.target.error}`, "color:red");
          reject(event.target.error);
        };
      } catch (error) {
        console.log(`%cError: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  
  getAllRecords(storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const transaction = this.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();
  
        request.onsuccess = (event) => {
          const records = event.target.result;
          console.log(`%cAll records retrieved from ${storeName}:`, "color:green", records);
          resolve(records);
        };
  
        request.onerror = (event) => {
          console.log(`%cError retrieving records: ${event.target.error}`, "color:red");
          reject(event.target.error);
        };
      } catch (error) {
        console.log(`%cError: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  renameObjectStore(oldName, newName) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const objectStoreNames = this.db.objectStoreNames;
        if (objectStoreNames.contains(oldName)) {
          const transaction = this.db.versionchangeTransaction([oldName], 'readwrite');
          transaction.objectStore(oldName).name = newName;
          console.log(`%cObject store '${oldName}' renamed to '${newName}'`, "color:green");
          resolve(true);
        } else {
          console.log(`%cObject store '${oldName}' does not exist`, "color:red");
          resolve(false);
        }
      } catch (error) {
        console.log(`%cError renaming object store: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  
  deleteObjectStore(storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const objectStoreNames = this.db.objectStoreNames;
        if (objectStoreNames.contains(storeName)) {
          this.db.deleteObjectStore(storeName);
          console.log(`%cObject store '${storeName}' deleted successfully`, "color:green");
          resolve(true);
        } else {
          console.log(`%cObject store '${storeName}' does not exist`, "color:red");
          resolve(false);
        }
      } catch (error) {
        console.log(`%cError deleting object store: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  
  createIndex(storeName, indexName, keyPath, unique = false) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const objectStoreNames = this.db.objectStoreNames;
        if (objectStoreNames.contains(storeName)) {
          const transaction = this.db.versionchangeTransaction([storeName], 'readwrite');
          const objectStore = transaction.objectStore(storeName);
          objectStore.createIndex(indexName, keyPath, { unique: unique });
          console.log(`%cIndex '${indexName}' created in object store '${storeName}'`, "color:green");
          resolve(true);
        } else {
          console.log(`%cObject store '${storeName}' does not exist`, "color:red");
          resolve(false);
        }
      } catch (error) {
        console.log(`%cError creating index: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  
  deleteIndex(storeName, indexName) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.db) {
          await this.openCreateDB();
        }
  
        const objectStoreNames = this.db.objectStoreNames;
        if (objectStoreNames.contains(storeName)) {
          const transaction = this.db.versionchangeTransaction([storeName], 'readwrite');
          const objectStore = transaction.objectStore(storeName);
          objectStore.deleteIndex(indexName);
          console.log(`%cIndex '${indexName}' deleted from object store '${storeName}'`, "color:green");
          resolve(true);
        } else {
          console.log(`%cObject store '${storeName}' does not exist`, "color:red");
          resolve(false);
        }
      } catch (error) {
        console.log(`%cError deleting index: ${error}`, "color:red");
        reject(error);
      }
    });
  },
  
  deleteDatabase() {
    return new Promise((resolve, reject) => {
      const request = this.indexDB.deleteDatabase(this.dbName);
  
      request.onsuccess = () => {
        console.log(`%cDatabase '${this.dbName}' deleted successfully`, "color:green");
        resolve(true);
      };
  
      request.onerror = (event) => {
        console.log(`%cError deleting database '${this.dbName}': ${event.target.error}`, "color:red");
        reject(event.target.error);
      };
    });
  },
  deleteOtherDatabases() {
    return new Promise(async (resolve, reject) => {
      try {
        // Obtener el nombre de la base de datos utilizada por DBVersionManager
        const dbManagerName = DBVersionManager.name;
  
        // Obtener una lista de todas las bases de datos
        const databaseNames = await this.vBD.getAllDb()
  
        // Eliminar las bases de datos que no sean la utilizada por DBVersionManager
        const deletePromises = [];
        for (const db of databaseNames.data) {
          const deletePromise = new Promise(async (resolve, reject) => {
            console.log(this.vBD.log(`Drop BD:[${db.name}]`,0))
            const request = window.indexedDB.deleteDatabase(db.name);
            await this.vBD.deleteByName(db.name);
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
          });
          deletePromises.push(deletePromise);
        }
  
        // Esperar a que se completen todas las eliminaciones
        await Promise.all(deletePromises);
        console.log('All databases except DBVersionManager database deleted successfully');
        resolve(true);
      } catch (error) {
        console.log(`Error deleting other databases: ${error}`);
        reject(error);
      }
    });
  }
};


//ejemplo
const storeConfigs = [
  {
    name: 'usuarios',
    keyPath: 'id',
    autoIncrement: true,
    indices: [
      { name: 'nombre', keyPath: 'nombre', unique: false },
      { name: 'apellido', keyPath: 'apellido', unique: false },
      { name: 'numeroCelular', keyPath: 'numeroCelular', unique: true },
      { name: 'fechaNacimiento', keyPath: 'fechaNacimiento', unique: false },
      { name: 'pais', keyPath: 'pais', unique: false },
      { name: 'direccion', keyPath: 'direccion', unique: false }
    ]
  }
];


document.addEventListener("DOMContentLoaded", async () => {
  const db =DBRLv2;// new DBRL("GATO090");
  db.ini()
  db.openCreateDB("PERSON")
  await db.createObjectStore(storeConfigs);
  const userForm = document.getElementById("userForm");
  const results = document.getElementById("results");

  function getUserData() {
      return {
          name: userForm.userName.value,
          apellido: userForm.userSurname.value,
          numeroCelular: userForm.userPhone.value,
          fechaNacimiento: userForm.userBirthdate.value,
          pais: userForm.userCountry.value,
          direccion: userForm.userAddress.value,
      };

  }


  document.getElementById("addUser").addEventListener("click", async () => {
      const userData = getUserData();
      await db.addRecord("usuarios", userData);
      results.textContent = `Usuario agregado: ${JSON.stringify(userData)}`;
  });

  document.getElementById("editUser").addEventListener("click", async () => {
      const userData = getUserData();
      const userId = parseInt(prompt("Ingrese el ID del usuario a editar:"));
      userData.id = userId;
      await db.updateRecord("usuarios", userData);
      results.textContent = `Usuario editado: ${JSON.stringify(userData)}`;
  });

  document.getElementById("deleteUser").addEventListener("click", async () => {
      const userId = parseInt(prompt("Ingrese el ID del usuario a eliminar:"));
      await db.deleteRecord("usuarios", userId);
      results.textContent = `Usuario eliminado: ID=${userId}`;
  });

  document.getElementById("findUser").addEventListener("click", async () => {
      const userId = parseInt(prompt("Ingrese el ID del usuario a buscar:"));
      const user = await db.getRecord("usuarios", userId);
      if (user) {
          results.textContent = `Usuario encontrado: ${JSON.stringify(user)}`;
      } else {
          results.textContent = `Usuario no encontrado: ID=${userId}`;
      }
  });

  document.getElementById("listUsers").addEventListener("click", async () => {
    // Datos de usuarios para la demostración
    const users = await db.getAllRecords("usuarios");
    //let users=data.data;
    
    let html = "";
  
    if (users.length > 0) {
      html += "<h3>Lista de Usuarios:</h3>";
      html += "<table border='1'><thead><tr>";
      // Crear los encabezados de la tabla basados en las claves del primer usuario
      const headers = ["ID","Nombre", "Apellido", "Número de Celular", "Fecha de Nacimiento", "País", "Dirección"];
      headers.forEach(header => {
        html += `<th>${header}</th>`;
      });
      html += "</tr></thead><tbody>";
  
      // Llenar la tabla con los datos de los usuarios
      users.forEach(user => {
        html += "<tr>";
        html += `<td>${user.id}</td>`;
        html += `<td>${user.name}</td>`;
        html += `<td>${user.apellido}</td>`;
        html += `<td>${user.numeroCelular}</td>`;
        html += `<td>${user.fechaNacimiento}</td>`;
        html += `<td>${user.pais}</td>`;
        html += `<td>${user.direccion}</td>`;
        html += "</tr>";
      });
  
      html += "</tbody></table>";
    } else {
      html = "No hay usuarios registrados.";
    }
  
    // Actualizar el contenido del elemento results
    document.getElementById("results").innerHTML = html;
  });
  
});
