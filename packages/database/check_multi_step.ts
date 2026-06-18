import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMultiStep(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: {
          include: {
            branches: {
              select: {
                id: true,
                name: true,
                defaultJourneyMode: true,
                services: {
                  select: {
                    serviceId: true,
                    journeyModeOverride: true,
                    service: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log(`User: ${user.email}`);
    console.log(`Organization: ${user.organization.name}`);
    console.log('--- Branches ---');

    user.organization.branches.forEach((branch: any) => {
      console.log(`Branch: ${branch.name}`);
      console.log(`  Default Journey Mode: ${branch.defaultJourneyMode}`);

      const multiStepServices = branch.services.filter(
        (s: any) => s.journeyModeOverride === 'visit_multi_step',
      );
      if (multiStepServices.length > 0) {
        console.log('  Services with Multi-step override:');
        multiStepServices.forEach((s: any) => {
          console.log(`    - ${s.service.name}`);
        });
      }
    });
  } catch (error) {
    console.error('Error checking multi-step:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMultiStep('parsasamandizadeh@gmail.com');
