import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function FavoritesLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-2 border-primary/30 mb-8 bg-gradient-to-br from-card to-primary/5">
          <CardContent className="p-6 sm:p-8 space-y-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-96" />
          </CardContent>
        </Card>

        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="w-full h-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
