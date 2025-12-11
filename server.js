const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise'); // Menggunakan versi promise untuk async/await

const app = express();
const port = 3000;

// Konfigurasi koneksi MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // Kosong jika pakai XAMPP default
    database: 'db_labitama', // Diubah sesuai nama database Anda
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test koneksi database
pool.getConnection()
    .then(connection => {
        console.log('Terhubung ke database MySQL!');
        connection.release(); // Lepaskan koneksi
    })
    .catch(err => {
        console.error('Gagal terhubung ke database MySQL:', err);
        process.exit(1); // Keluar jika koneksi gagal
    });


// For Server-Sent Events (SSE)
let clients = [];

// New: Helper to get available projector IDs - Akan diubah nanti
const getAvailableProjectorIds = async () => {
    // Implementasi ini akan diubah untuk mengambil data dari MySQL
    // Untuk sementara, biarkan kosong atau kembalikan array kosong
    return []; 
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- Helper Functions --- (yang sudah dihapus)

const broadcastToAdmins = (data) => {
    clients.forEach(client => {
        if (client.isAdmin) client.res.write(`data: ${JSON.stringify(data)}
\n`);
    });
}

const sendEventToUser = (userId, data) => {
    const client = clients.find(c => c.userId === userId);
    if (client) client.res.write(`data: ${JSON.stringify(data)}
\n`);
}

// --- Main Endpoints ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// New: Serve the laptop database admin page
app.get('/database-laptop', (req, res) => {
    res.sendFile(path.join(__dirname, 'database_laptop.html'));
});

// --- Laptop Endpoints --- // Diubah ke MySQL
// GET all laptops
app.get('/api/laptops', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                l.id_laptop as id, 
                l.merek, 
                l.id_mahasiswa as idMahasiswaPemilik, -- New: owner's ID
                m.nama_mahasiswa as namaPemilik     -- New: owner's name from mahasiswas
            FROM laptop l
            LEFT JOIN mahasiswas m ON l.id_mahasiswa = m.id_mahasiswa
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching laptops:', err);
        res.status(500).json({ message: 'Gagal mengambil data laptop.' });
    }
});

// POST a new laptop
app.post('/api/laptops', async (req, res) => {
    const { id, merek, idMahasiswaPemilik } = req.body; // Removed prodi
    try {
        const [existing] = await pool.query('SELECT id_laptop FROM laptop WHERE id_laptop = ?', [id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'ID Laptop sudah ada.' });
        }
        // Validate if idMahasiswaPemilik exists in mahasiswas
        if (idMahasiswaPemilik) {
            const [mahasiswaRows] = await pool.query('SELECT id_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [idMahasiswaPemilik]);
            if (mahasiswaRows.length === 0) {
                return res.status(400).json({ message: 'ID Mahasiswa Pemilik tidak terdaftar.' });
            }
        }
        
        await pool.query('INSERT INTO laptop (id_laptop, merek, id_mahasiswa) VALUES (?, ?, ?)', [id, merek, idMahasiswaPemilik]); // Removed prodi
        res.status(201).json({ message: 'Laptop berhasil ditambahkan', laptop: { id, merek, idMahasiswaPemilik } }); // Removed prodi
    } catch (err) {
        console.error('Error adding laptop:', err); // Log full error object
        res.status(500).json({ message: 'Gagal menambahkan laptop.' });
    }
});

// PUT (update) a laptop
app.put('/api/laptops/:id', async (req, res) => {
    const laptopId = req.params.id;
    const { merek, idMahasiswaPemilik } = req.body; // Removed prodi
    try {
        // Validate if idMahasiswaPemilik exists in mahasiswas
        if (idMahasiswaPemilik) {
            const [mahasiswaRows] = await pool.query('SELECT id_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [idMahasiswaPemilik]);
            if (mahasiswaRows.length === 0) {
                return res.status(400).json({ message: 'ID Mahasiswa Pemilik tidak terdaftar.' });
            }
        }
        const [result] = await pool.query('UPDATE laptop SET merek = ?, id_mahasiswa = ? WHERE id_laptop = ?', [merek, idMahasiswaPemilik, laptopId]); // Removed prodi
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Laptop tidak ditemukan.' });
        }
        res.json({ message: 'Data laptop berhasil diperbarui' });
    } catch (err) {
        console.error('Error updating laptop:', err); // Log full error object
        res.status(500).json({ message: 'Gagal memperbarui data laptop.' });
    }
});

// DELETE a laptop
app.delete('/api/laptops/:id', async (req, res) => {
    const laptopId = req.params.id;
    try {
        const [result] = await pool.query('DELETE FROM laptop WHERE id_laptop = ?', [laptopId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Laptop tidak ditemukan.' });
        }
        res.json({ message: 'Laptop berhasil dihapus.' });
    } catch (err) {
        console.error('Error deleting laptop:', err);
        res.status(500).json({ message: 'Gagal menghapus laptop.' });
    }
});

// New: Serve the projector database admin page
app.get('/database-proyektor', (req, res) => {
    res.sendFile(path.join(__dirname, 'database_proyektor.html'));
});

// New: Serve the mahasiswa database admin page
app.get('/database-mahasiswas', (req, res) => {
    res.sendFile(path.join(__dirname, 'database_mahasiswas.html'));
});

// --- Projector Endpoints --- // Diubah ke MySQL
// GET all projectors
app.get('/api/projectors', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id_proyektor as id, merek, milik FROM proyektor');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching projectors:', err);
        res.status(500).json({ message: 'Gagal mengambil data proyektor.' });
    }
});

// POST a new projector
app.post('/api/projectors', async (req, res) => {
    const { id, merek, milik } = req.body;
    try {
        const [existing] = await pool.query('SELECT id_proyektor FROM proyektor WHERE id_proyektor = ?', [id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'ID Proyektor sudah ada.' });
        }
        
        await pool.query('INSERT INTO proyektor (id_proyektor, merek, milik) VALUES (?, ?, ?)', [id, merek, milik]);
        res.status(201).json({ message: 'Proyektor berhasil ditambahkan', projector: { id, merek, milik } });
    } catch (err) {
        console.error('Error adding projector:', err);
        res.status(500).json({ message: 'Gagal menambahkan proyektor.' });
    }
});

// PUT (update) a projector
app.put('/api/projectors/:id', async (req, res) => {
    const projectorId = req.params.id;
    const { merek, milik } = req.body;
    try {
        const [result] = await pool.query('UPDATE proyektor SET merek = ?, milik = ? WHERE id_proyektor = ?', [merek, milik, projectorId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proyektor tidak ditemukan.' });
        }
        res.json({ message: 'Data proyektor berhasil diperbarui' });
    } catch (err) {
        console.error('Error updating projector:', err);
        res.status(500).json({ message: 'Gagal memperbarui data proyektor.' });
    }
});

// DELETE a projector
app.delete('/api/projectors/:id', async (req, res) => {
    const projectorId = req.params.id;
    try {
        const [result] = await pool.query('DELETE FROM proyektor WHERE id_proyektor = ?', [projectorId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proyektor tidak ditemukan.' });
        }
        res.json({ message: 'Proyektor berhasil dihapus.' });
    } catch (err) {
        console.error('Error deleting projector:', err);
        res.status(500).json({ message: 'Gagal menghapus proyektor.' });
    }
});

// --- Mahasiswas Endpoints ---
// GET all mahasiswas
app.get('/api/mahasiswas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id_mahasiswa, nama_mahasiswa, prodi FROM mahasiswas');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching mahasiswas:', err);
        res.status(500).json({ message: 'Gagal mengambil data mahasiswa.' });
    }
});

// POST a new mahasiswa
app.post('/api/mahasiswas', async (req, res) => {
    const { id_mahasiswa, nama_mahasiswa, prodi } = req.body;
    try {
        const [existing] = await pool.query('SELECT id_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [id_mahasiswa]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'ID Mahasiswa sudah ada.' });
        }
        await pool.query('INSERT INTO mahasiswas (id_mahasiswa, nama_mahasiswa, prodi) VALUES (?, ?, ?)', [id_mahasiswa, nama_mahasiswa, prodi]);
        res.status(201).json({ message: 'Mahasiswa berhasil ditambahkan', mahasiswa: { id_mahasiswa, nama_mahasiswa, prodi } });
    } catch (err) {
        console.error('Error adding mahasiswa:', err);
        res.status(500).json({ message: 'Gagal menambahkan mahasiswa.' });
    }
});

// PUT (update) a mahasiswa
app.put('/api/mahasiswas/:id_mahasiswa', async (req, res) => {
    const mahasiswaId = req.params.id_mahasiswa;
    const { nama_mahasiswa, prodi } = req.body;
    try {
        const [result] = await pool.query('UPDATE mahasiswas SET nama_mahasiswa = ?, prodi = ? WHERE id_mahasiswa = ?', [nama_mahasiswa, prodi, mahasiswaId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Mahasiswa tidak ditemukan.' });
        }
        res.json({ message: 'Data mahasiswa berhasil diperbarui' });
    } catch (err) {
        console.error('Error updating mahasiswa:', err);
        res.status(500).json({ message: 'Gagal memperbarui data mahasiswa.' });
    }
});

// DELETE a mahasiswa
app.delete('/api/mahasiswas/:id_mahasiswa', async (req, res) => {
    const mahasiswaId = req.params.id_mahasiswa;
    const connection = await pool.getConnection(); // Get a connection from the pool

    try {
        await connection.beginTransaction(); // Start transaction

        // 1. Delete related loans (peminjaman) where the student is the borrower
        await connection.query('DELETE FROM peminjaman WHERE id_mahasiswa = ?', [mahasiswaId]);

        // 2. Delete related laptops owned by the student
        await connection.query('DELETE FROM laptop WHERE id_mahasiswa = ?', [mahasiswaId]);

        // 3. Delete the student (mahasiswa)
        const [result] = await connection.query('DELETE FROM mahasiswas WHERE id_mahasiswa = ?', [mahasiswaId]);

        if (result.affectedRows === 0) {
            // If the student didn't exist in the first place, no need to commit, just rollback.
            await connection.rollback();
            return res.status(404).json({ message: 'Mahasiswa tidak ditemukan.' });
        }

        await connection.commit(); // Commit transaction if all deletions were successful
        res.json({ message: 'Mahasiswa dan semua data terkait (laptop, peminjaman) berhasil dihapus.' });

    } catch (err) {
        await connection.rollback(); // Rollback on any error
        console.error('Error deleting mahasiswa:', err);
        // Also check for the specific foreign key error and give a more targeted message if needed
        res.status(500).json({ message: 'Gagal menghapus mahasiswa.', error: err.message });
    } finally {
        connection.release(); // Always release the connection back to the pool
    }
});

// New: GET available projector IDs (MySQL version)

app.get('/api/projectors/available', async (req, res) => {

    try {

        const query = `

            SELECT p.id_proyektor FROM proyektor p

            LEFT JOIN peminjaman l ON p.id_proyektor = l.id_perangkat AND l.status = 'active'

            WHERE l.id_peminjaman IS NULL

        `;

        const [rows] = await pool.query(query);

        const availableIds = rows.map(r => r.id_proyektor);

        res.json(availableIds);

    } catch (err) {

        console.error('Error fetching available projectors:', err);

        res.status(500).json({ message: 'Gagal mengambil data proyektor yang tersedia.' });

    }

});



// SSE Endpoint



app.get('/api/events', (req, res) => {

    res.setHeader('Content-Type', 'text/event-stream');

    res.setHeader('Cache-Control', 'no-cache');

    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();



    const clientId = Date.now();

    const { userId } = req.query;

    const newClient = { id: clientId, res, userId, isAdmin: !userId };

    clients.push(newClient);



    req.on('close', () => {

        clients = clients.filter(client => client.id !== clientId);

    });

});



// --- Inventory Endpoint (Dihapus karena tidak relevan lagi) ---

// app.get('/api/inventory', ...)



// --- Loan Endpoints --- // Diubah ke MySQL



// GET all loans

app.get('/api/loans', async (req, res) => {
  try {
      const [rows] = await pool.query(`
          SELECT 
              p.id_peminjaman as id,
              p.id_mahasiswa as studentId,
              m_borrower.nama_mahasiswa as borrowerName,
              p.tipe_perangkat as device, 
              p.id_perangkat as deviceId, 
              p.waktu_pinjam as borrowedAt, 
              p.waktu_kembali as returnedAt, 
              p.status,
              COALESCE(p.nama_pemilik_perangkat, proj.milik) AS deviceOwnerName
          FROM peminjaman p
          JOIN mahasiswas m_borrower ON p.id_mahasiswa = m_borrower.id_mahasiswa
          LEFT JOIN proyektor proj ON p.id_perangkat = proj.id_proyektor AND p.tipe_perangkat = 'Proyektor'
          ORDER BY p.waktu_pinjam DESC
      `);
      res.json(rows);
  } catch (err) {
      console.error('Error fetching loans:', err);
      res.status(500).json({ message: 'Gagal mengambil data peminjaman.' });
  }
});

          

          // POST a new loan



// POST a new loan

app.post('/api/loans', async (req, res) => {
    const { id_mahasiswa, deviceType } = req.body; // deviceId will be determined for Laptop
    let { deviceId } = req.body; // deviceId is explicitly passed for Projector
    let namaPeminjam = null;
    let namaPemilikPerangkat = null;

    try {
        // 1. Validate id_mahasiswa (borrower) against mahasiswas table
        const [mahasiswaRows] = await pool.query('SELECT nama_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [id_mahasiswa]);
        if (mahasiswaRows.length === 0) {
            return res.status(400).json({ message: 'ID Mahasiswa (Peminjam) tidak terdaftar.' });
        }
        namaPeminjam = mahasiswaRows[0].nama_mahasiswa;

        // 2. Determine deviceId for Laptop if not provided and fetch owner name
        if (deviceType === 'Laptop') {
            // Find an available laptop owned by this student
            const [availableLaptops] = await pool.query(`
                SELECT l.id_laptop, l.id_mahasiswa FROM laptop l
                LEFT JOIN peminjaman p ON l.id_laptop = p.id_perangkat AND p.tipe_perangkat = 'Laptop' AND p.status = 'active'
                WHERE p.id_peminjaman IS NULL AND l.id_mahasiswa = ? LIMIT 1
            `, [id_mahasiswa]);

            if (availableLaptops.length === 0) {
                return res.status(400).json({ message: 'Tidak ada laptop yang tersedia yang Anda miliki.' });
            }
            deviceId = availableLaptops[0].id_laptop; // Automatically assign the first available laptop

            // Fetch owner's name for this automatically assigned laptop
            if (availableLaptops[0].id_mahasiswa) {
                const [ownerMahasiswaRows] = await pool.query('SELECT nama_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [availableLaptops[0].id_mahasiswa]);
                if (ownerMahasiswaRows.length > 0) {
                    namaPemilikPerangkat = ownerMahasiswaRows[0].nama_mahasiswa;
                }
            }
        } else if (deviceType === 'Proyektor') {
            // For Projector, deviceId should be provided from frontend
            if (!deviceId) {
                return res.status(400).json({ message: 'ID Proyektor harus dipilih.' });
            }
            const [projectors] = await pool.query('SELECT id_proyektor FROM proyektor WHERE id_proyektor = ?', [deviceId]);
            if (projectors.length === 0) {
                return res.status(400).json({ message: 'ID Proyektor tidak terdaftar.' });
            }
            // For projectors, namaPemilikPerangkat remains null as per previous logic
        }

        // 3. Cek apakah perangkat sedang dipinjam (this check is effectively done by the availableLaptops query above for Laptops)
        // Re-check for both device types for robustness if deviceId was not auto-assigned
        const [activeLoans] = await pool.query("SELECT id_peminjaman FROM peminjaman WHERE id_perangkat = ? AND status = 'active'", [deviceId]);
        if (activeLoans.length > 0) {
            return res.status(400).json({ message: `Perangkat dengan ID ${deviceId} sedang dipinjam.` });
        }

        // 4. Cek apakah user punya peminjaman yang sudah dikembalikan (untuk reaktivasi)
        const [returnedLoans] = await pool.query("SELECT id_peminjaman FROM peminjaman WHERE id_mahasiswa = ? AND id_perangkat = ? AND status = 'returned' ORDER BY waktu_kembali DESC LIMIT 1", [id_mahasiswa, deviceId]);
        if (returnedLoans.length > 0) {
            const loanToReactivateId = returnedLoans[0].id_peminjaman;
            let updateNamaPemilik = '';
            let updateNamaPeminjam = '';

            // Update nama_pemilik_perangkat if device is Laptop during reactivation
            if (deviceType === 'Laptop') {
                 const [laptops] = await pool.query('SELECT id_mahasiswa FROM laptop WHERE id_laptop = ?', [deviceId]);
                 if (laptops.length > 0 && laptops[0].id_mahasiswa) {
                     const [ownerMahasiswaRows] = await pool.query('SELECT nama_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [laptops[0].id_mahasiswa]);
                     if (ownerMahasiswaRows.length > 0) {
                         updateNamaPemilik = `, nama_pemilik_perangkat = '${ownerMahasiswaRows[0].nama_mahasiswa}'`;
                     }
                 }
            }
            // Always update nama_peminjam during reactivation
            updateNamaPeminjam = `, nama_peminjam = '${namaPeminjam}'`;

            await pool.query(`UPDATE peminjaman SET waktu_pinjam = NOW(), waktu_kembali = NULL, status = 'active'${updateNamaPemilik}${updateNamaPeminjam} WHERE id_peminjaman = ?`, [loanToReactivateId]);
            broadcastToAdmins({ type: 'loan_updated' });
            return res.status(200).json({ message: 'Peminjaman berhasil diaktifkan kembali.' });
        }

        // 5. Jika tidak ada, buat peminjaman baru
        const [result] = await pool.query(
            "INSERT INTO peminjaman (id_mahasiswa, tipe_perangkat, id_perangkat, waktu_pinjam, status, nama_pemilik_perangkat, nama_peminjam) VALUES (?, ?, ?, NOW(), 'active', ?, ?)",
            [id_mahasiswa, deviceType, deviceId, namaPemilikPerangkat, namaPeminjam]
        );
        broadcastToAdmins({ type: 'loan_updated' });
        res.status(201).json({ message: 'Peminjaman baru berhasil dibuat', id: result.insertId });

    } catch (err) {
        console.error('Error creating loan:', err);
        res.status(500).json({ message: 'Gagal membuat peminjaman.', error: err.message });
    }
});


// GET active loan for a student for a specific device type
app.get('/api/loans/active/:id_mahasiswa', async (req, res) => {
    const { deviceType } = req.query;
    if (!deviceType) {
        return res.status(400).json({ message: 'Device type is required.' });
    }

    try {
        const [rows] = await pool.query(`
            SELECT 
                id_peminjaman as id,
                id_mahasiswa as studentId,
                tipe_perangkat as device, 
                id_perangkat as deviceId, 
                status 
            FROM peminjaman 
            WHERE id_mahasiswa = ? AND tipe_perangkat = ? AND status IN ('active', 'pending_extension')
        `, [req.params.id_mahasiswa, deviceType]);

        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Tidak ada peminjaman aktif untuk user dan perangkat ini' });
        }
    } catch (err) {
        console.error('Error fetching active loan:', err);
        res.status(500).json({ message: 'Gagal mengambil data peminjaman.' });
    }
});



// PUT (update) a loan to 'returned'

app.put('/api/loans/:id', async (req, res) => {

    // Endpoint ini khusus untuk menandai sebagai 'dikembalikan'

    if (req.body.returnedAt) {

        try {

            const [result] = await pool.query("UPDATE peminjaman SET status = 'returned', waktu_kembali = NOW() WHERE id_peminjaman = ?", [req.params.id]);

            if (result.affectedRows === 0) {

                return res.status(404).json({ message: 'Peminjaman tidak ditemukan' });

            }

            broadcastToAdmins({ type: 'loan_updated' });

            res.json({ message: 'Data peminjaman berhasil diperbarui' });

        } catch (err) {

            console.error('Error updating loan:', err);

            res.status(500).json({ message: 'Gagal memperbarui data peminjaman.' });

        }

    } else {

        res.status(400).json({ message: 'Hanya pembaruan status pengembalian yang diizinkan.' });

    }

});



// POST to REQUEST a reloan (by user)

app.post('/api/loans/:id/request-reloan', async (req, res) => {

    try {

        const [result] = await pool.query("UPDATE peminjaman SET status = 'pending_extension' WHERE id_peminjaman = ? AND status = 'active'", [req.params.id]);

        if (result.affectedRows === 0) {

            return res.status(404).json({ message: 'Peminjaman aktif tidak ditemukan untuk diminta perpanjangan.' });

        }

        broadcastToAdmins({ type: 'loan_updated' });

        res.json({ message: 'Permintaan perpanjangan pinjaman telah dikirim ke admin.' });

    } catch (err) {

        console.error('Error requesting reloan:', err);

        res.status(500).json({ message: 'Gagal meminta perpanjangan.' });

    }

});



// POST to CONFIRM a reloan (by admin)

app.post('/api/loans/:id/confirm-reloan', async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();



        // 1. Dapatkan data peminjaman lama

        const [loans] = await connection.query("SELECT * FROM peminjaman WHERE id_peminjaman = ? AND status = 'pending_extension' FOR UPDATE", [req.params.id]);

        if (loans.length === 0) {

            throw new Error('Peminjaman tidak ditemukan atau statusnya bukan menunggu perpanjangan.');

        }

        const originalLoan = loans[0];



        // Fetch borrower's name for the new loan from mahasiswas table

        const [borrowerMahasiswaRows] = await connection.query('SELECT nama_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [originalLoan.id_mahasiswa]);

        let namaPeminjam = null;

        if (borrowerMahasiswaRows.length > 0) {

            namaPeminjam = borrowerMahasiswaRows[0].nama_mahasiswa;

        }



        let namaPemilikPerangkat = null;

        if (originalLoan.tipe_perangkat === 'Laptop') {

            const [laptops] = await connection.query('SELECT id_mahasiswa FROM laptop WHERE id_laptop = ?', [originalLoan.id_perangkat]);

            if (laptops.length > 0 && laptops[0].id_mahasiswa) {

                const [ownerMahasiswaRows] = await connection.query('SELECT nama_mahasiswa FROM mahasiswas WHERE id_mahasiswa = ?', [laptops[0].id_mahasiswa]);

                if (ownerMahasiswaRows.length > 0) {

                    namaPemilikPerangkat = ownerMahasiswaRows[0].nama_mahasiswa;

                }

            }

        }



                // 2. Perbarui pinjaman yang ada untuk menjadi aktif kembali



                await connection.query("UPDATE peminjaman SET status = 'active', waktu_pinjam = NOW(), waktu_kembali = NULL WHERE id_peminjaman = ?", [req.params.id]);



        



                await connection.commit();



                



                broadcastToAdmins({ type: 'loan_updated' });



                sendEventToUser(originalLoan.id_mahasiswa, { type: 'reloan_confirmed', device: originalLoan.tipe_perangkat }); // Changed id_user to id_mahasiswa



        



                res.status(200).json({ message: 'Peminjaman berhasil diperpanjang.' });



    } catch (err) {

        await connection.rollback();

        console.error('Error confirming reloan:', err);

        res.status(500).json({ message: err.message || 'Gagal mengkonfirmasi perpanjangan.' });

    } finally {

        connection.release();

    }

});



// DELETE a loan

app.delete('/api/loans/:id', async (req, res) => {

    try {

        const [result] = await pool.query("DELETE FROM peminjaman WHERE id_peminjaman = ?", [req.params.id]);

        if (result.affectedRows === 0) {

            return res.status(404).json({ message: 'Peminjaman tidak ditemukan' });

        }

        broadcastToAdmins({ type: 'loan_updated' });

        res.json({ message: 'Data peminjaman berhasil dihapus' });

    } catch (err) {

        console.error('Error deleting loan:', err);

        res.status(500).json({ message: 'Gagal menghapus data peminjaman.' });

    }

});




app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
