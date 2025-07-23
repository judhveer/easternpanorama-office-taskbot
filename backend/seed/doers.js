const sequelize = require('../config/db');
const Doer = require('../models/Doer');

const nameToDepartment = {
  "EVAMEDALYNE LANGSTANG": "Accounts",
  "RAJESH KUMAR THAKUR": "Accounts",
  "ANISHA LYNGDOH": "Admin",
  "ALVIN KHARBAMON": "Admin",
  "KIRAN DAS": "Admin",
  "AIDAHUNLIN NALLE JYRWA": "CRM",
  "FANNY": "CRM",
  "DORIS": "Designer",
  "MEWANKHRAW MAJAW": "Designer",
  "SANJAY THAPA": "Designer",
  "SICOVONTRITCHZ D THANGKHIEW": "Designer",
  "TITU BHOWMICK": "Designer",
  "WANHUNLANG KHARSATI": "Designer",
  "MONICA LYNGDOH": "EA",
  "MOHAMMED SERAJ ANSARI": "EA",
  "ROSHAN": "EA",
  "YUMNAM JACKSON SINGH": "Foundation",
  "JENNIFER JYRWA": "HR",
  "ANITA DORJEE": "MIS",
  "EWAN HA I SHYLLA": "Office Assistant",
  "BHAGYASHREE SINHA": "Process Coordinator",
  "HIMANI": "Process Coordinator",
  "SAFIRALIN": "Receptionist",
  "BANTYNSHAIN LYNGDOH": "Sales dept",
  "SHANLANG": "Tender Executive"
};

const seedDepartments = async () => {
  try {
    await sequelize.sync();

    // Loop through each entry and update Doer
    for (const [name, department] of Object.entries(nameToDepartment)) {

      const [doer, created] = await Doer.findOrCreate({
        where: { name },
        defaults: { department }
      });

      if (!created) {
        await doer.update({ department });
        console.log(`✅ Updated ${name} to department: ${department}`);
      } else {
        console.log(`🆕 Created doer: ${name} with department: ${department}`);
      }
    }

    console.log('🎉 Department update finished!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating departments:', error);
    process.exit(1);
  }
};

seedDepartments();
