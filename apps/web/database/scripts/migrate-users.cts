import User from '../user.model';
import dbConnect from '@/lib/mongoose';

async function migrateUsers() {
  await dbConnect();

  const users = await User.find();

  console.log('users found', users);
}

migrateUsers()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration Error', err);
    process.exit(1);
  });
